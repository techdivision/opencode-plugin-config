/**
 * Acceptance Tests for US-CFG-060: Plugin npm Publish to GitHub Packages
 *
 * Validates the GitHub Actions workflow file (.github/workflows/publish.yml)
 * ensures correct trigger, steps, permissions, and idempotent publish behavior.
 *
 * Uses vitest-cucumber with loadFeature/describeFeature format.
 */
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse as parseYaml } from 'yaml'

const feature = await loadFeature(
  'tests/acceptance/gherkin/epic-cfg-05/us-cfg-060-plugin-npm-publish.feature',
)

const WORKFLOW_PATH = resolve('.github/workflows/publish.yml')
const PACKAGE_JSON_PATH = resolve('package.json')

/**
 * Reads and parses the workflow YAML file.
 * Returns the parsed object or null if file does not exist.
 */
function loadWorkflow(): Record<string, unknown> | null {
  if (!existsSync(WORKFLOW_PATH)) {
    return null
  }
  const content = readFileSync(WORKFLOW_PATH, 'utf-8')
  return parseYaml(content) as Record<string, unknown>
}

/**
 * Reads and parses the root package.json.
 */
function loadPackageJson(): Record<string, unknown> {
  const content = readFileSync(PACKAGE_JSON_PATH, 'utf-8')
  return JSON.parse(content) as Record<string, unknown>
}

describeFeature(feature, ({ Scenario }) => {
  // ── Scenario 1: Workflow file exists ──────────────────────────────────
  Scenario('Workflow file exists', ({ Given, When, Then, And }) => {
    let fileExists = false
    let parsedYaml: Record<string, unknown> | null = null

    Given('the repository has been cloned', () => {
      // Repository context is implicit -- we are running inside the repo
    })

    When('I check the file ".github/workflows/publish.yml"', () => {
      fileExists = existsSync(WORKFLOW_PATH)
      if (fileExists) {
        parsedYaml = loadWorkflow()
      }
    })

    Then('the file exists', () => {
      expect(fileExists).toBe(true)
    })

    And('the file contains valid YAML', () => {
      expect(parsedYaml).not.toBeNull()
      expect(typeof parsedYaml).toBe('object')
    })
  })

  // ── Scenario 2: Workflow triggers on version tags ─────────────────────
  Scenario('Workflow triggers on version tags', ({ Given, When, Then, And }) => {
    let workflow: Record<string, unknown> | null = null
    let triggerConfig: Record<string, unknown> | null = null

    Given('the workflow file ".github/workflows/publish.yml" exists', () => {
      workflow = loadWorkflow()
      expect(workflow).not.toBeNull()
    })

    When('I inspect the trigger configuration', () => {
      triggerConfig = (workflow as Record<string, unknown>)['on'] as Record<string, unknown>
      expect(triggerConfig).toBeDefined()
    })

    Then('the workflow triggers on push to tags matching "v*"', () => {
      const push = triggerConfig!['push'] as Record<string, unknown>
      expect(push).toBeDefined()
      const tags = push['tags'] as string[]
      expect(tags).toBeDefined()
      expect(tags).toContain('v*')
    })

    And('the workflow does not trigger on branch pushes', () => {
      const push = triggerConfig!['push'] as Record<string, unknown>
      expect(push['branches']).toBeUndefined()
    })
  })

  // ── Scenario 3: Workflow publishes with correct configuration ─────────
  Scenario('Workflow publishes to GitHub Packages with correct configuration', ({ Given, When, Then, And }) => {
    let workflow: Record<string, unknown> | null = null
    let steps: Array<Record<string, unknown>> = []

    Given('the workflow file ".github/workflows/publish.yml" exists', () => {
      workflow = loadWorkflow()
      expect(workflow).not.toBeNull()
    })

    When('I inspect the job steps', () => {
      const jobs = workflow!['jobs'] as Record<string, Record<string, unknown>>
      const publishJob = jobs['publish']
      expect(publishJob).toBeDefined()
      steps = publishJob['steps'] as Array<Record<string, unknown>>
      expect(steps).toBeDefined()
      expect(Array.isArray(steps)).toBe(true)
    })

    Then('the workflow checks out the repository', () => {
      const checkoutStep = steps.find(
        (step) => typeof step['uses'] === 'string' && (step['uses'] as string).startsWith('actions/checkout'),
      )
      expect(checkoutStep).toBeDefined()
    })

    And('the workflow sets up Node.js version 20', () => {
      const setupNodeStep = steps.find(
        (step) => typeof step['uses'] === 'string' && (step['uses'] as string).startsWith('actions/setup-node'),
      )
      expect(setupNodeStep).toBeDefined()
      const withConfig = setupNodeStep!['with'] as Record<string, unknown>
      expect(withConfig).toBeDefined()
      expect(String(withConfig['node-version'])).toBe('20')
    })

    And('the workflow configures registry-url as "https://npm.pkg.github.com/"', () => {
      const setupNodeStep = steps.find(
        (step) => typeof step['uses'] === 'string' && (step['uses'] as string).startsWith('actions/setup-node'),
      )
      const withConfig = setupNodeStep!['with'] as Record<string, unknown>
      expect(withConfig['registry-url']).toBe('https://npm.pkg.github.com/')
    })

    And('the workflow runs "npm publish"', () => {
      const publishStep = steps.find(
        (step) => typeof step['run'] === 'string' && (step['run'] as string).includes('npm publish'),
      )
      expect(publishStep).toBeDefined()
      // Verify npm ci runs before npm publish
      const ciStep = steps.find(
        (step) => typeof step['run'] === 'string' && (step['run'] as string).includes('npm ci'),
      )
      expect(ciStep).toBeDefined()
      const ciIndex = steps.indexOf(ciStep!)
      const publishIndex = steps.indexOf(publishStep!)
      expect(ciIndex).toBeLessThan(publishIndex)
    })

    And('the npm publish uses the root package.json', () => {
      // The publish step should NOT specify a working-directory or --workspace flag,
      // meaning it uses the root package.json by default.
      const publishStep = steps.find(
        (step) => typeof step['run'] === 'string' && (step['run'] as string).includes('npm publish'),
      )
      expect(publishStep).toBeDefined()
      expect(publishStep!['working-directory']).toBeUndefined()
    })
  })

  // ── Scenario 4: Workflow uses GITHUB_TOKEN for authentication ─────────
  Scenario('Workflow uses GITHUB_TOKEN for authentication', ({ Given, When, Then, And }) => {
    let workflow: Record<string, unknown> | null = null
    let publishStep: Record<string, unknown> | undefined

    Given('the workflow file ".github/workflows/publish.yml" exists', () => {
      workflow = loadWorkflow()
      expect(workflow).not.toBeNull()
    })

    When('I inspect the environment configuration', () => {
      const jobs = workflow!['jobs'] as Record<string, Record<string, unknown>>
      const job = jobs['publish']
      const steps = job['steps'] as Array<Record<string, unknown>>
      publishStep = steps.find(
        (step) => typeof step['run'] === 'string' && (step['run'] as string).includes('npm publish'),
      )
      expect(publishStep).toBeDefined()
    })

    Then('the npm publish step uses "GITHUB_TOKEN" as "NODE_AUTH_TOKEN"', () => {
      const env = publishStep!['env'] as Record<string, string>
      expect(env).toBeDefined()
      expect(env['NODE_AUTH_TOKEN']).toBe('${{ secrets.GITHUB_TOKEN }}')
    })

    And('the workflow has "permissions: packages: write"', () => {
      const permissions = workflow!['permissions'] as Record<string, string>
      expect(permissions).toBeDefined()
      expect(permissions['packages']).toBe('write')
    })
  })

  // ── Scenario 5: package.json has publishConfig for GitHub Packages ────
  Scenario('package.json has publishConfig for GitHub Packages', ({ Given, When, Then }) => {
    let packageJson: Record<string, unknown>
    let publishConfig: Record<string, unknown> | undefined

    Given('the root "package.json" exists', () => {
      expect(existsSync(PACKAGE_JSON_PATH)).toBe(true)
      packageJson = loadPackageJson()
    })

    When('I inspect the publishConfig field', () => {
      publishConfig = packageJson!['publishConfig'] as Record<string, unknown>
      expect(publishConfig).toBeDefined()
    })

    Then('the registry is set to "https://npm.pkg.github.com/"', () => {
      expect(publishConfig!['registry']).toBe('https://npm.pkg.github.com/')
    })
  })

  // ── Scenario 6: Successful publish on tag push ────────────────────────
  Scenario('Successful publish on tag push', ({ Given, And, When, Then }) => {
    let workflow: Record<string, unknown> | null = null

    Given('the workflow triggers on tag "v0.1.0"', () => {
      workflow = loadWorkflow()
      expect(workflow).not.toBeNull()
      const onConfig = workflow!['on'] as Record<string, unknown>
      const push = onConfig['push'] as Record<string, unknown>
      const tags = push['tags'] as string[]
      // v0.1.0 matches the glob pattern v*
      expect(tags.some((pattern) => 'v0.1.0'.match(new RegExp('^' + pattern.replace('*', '.*') + '$')))).toBe(true)
    })

    And('the GITHUB_TOKEN is available', () => {
      // Verify that the workflow references GITHUB_TOKEN (structural check)
      const jobs = workflow!['jobs'] as Record<string, Record<string, unknown>>
      const steps = jobs['publish']['steps'] as Array<Record<string, unknown>>
      const publishStep = steps.find(
        (step) => typeof step['run'] === 'string' && (step['run'] as string).includes('npm publish'),
      )
      const env = publishStep!['env'] as Record<string, string>
      expect(env['NODE_AUTH_TOKEN']).toContain('GITHUB_TOKEN')
    })

    When('the workflow executes', () => {
      // Structural validation: workflow has all required steps to execute successfully
      const jobs = workflow!['jobs'] as Record<string, Record<string, unknown>>
      const steps = jobs['publish']['steps'] as Array<Record<string, unknown>>
      expect(steps.length).toBeGreaterThanOrEqual(4) // checkout, setup-node, npm ci, npm publish
    })

    Then('the package "@techdivision/opencode-plugin-config" is published to GitHub Packages', () => {
      // Verify package name matches what will be published
      const packageJson = loadPackageJson()
      expect(packageJson['name']).toBe('@techdivision/opencode-plugin-config')
      const publishConfig = packageJson['publishConfig'] as Record<string, unknown>
      expect(publishConfig['registry']).toBe('https://npm.pkg.github.com/')
    })

    And('the workflow exits with status 0', () => {
      // Structural: the publish step exists and is properly configured
      const jobs = workflow!['jobs'] as Record<string, Record<string, unknown>>
      const steps = jobs['publish']['steps'] as Array<Record<string, unknown>>
      const publishStep = steps.find(
        (step) => typeof step['run'] === 'string' && (step['run'] as string).includes('npm publish'),
      )
      expect(publishStep).toBeDefined()
    })
  })

  // ── Scenario 7: Workflow is idempotent ────────────────────────────────
  Scenario('Workflow is idempotent', ({ Given, When, Then }) => {
    let workflow: Record<string, unknown> | null = null

    Given('the package "@techdivision/opencode-plugin-config@0.1.0" already exists on GitHub Packages', () => {
      // Precondition: package already published (simulated context)
      workflow = loadWorkflow()
      expect(workflow).not.toBeNull()
    })

    When('the workflow triggers again on tag "v0.1.0"', () => {
      // Structural check: the tag pattern still matches
      const onConfig = workflow!['on'] as Record<string, unknown>
      const push = onConfig['push'] as Record<string, unknown>
      expect(push['tags']).toBeDefined()
    })

    Then('the workflow handles the duplicate version gracefully', () => {
      // The publish step must contain targeted error handling for duplicate versions
      // that distinguishes duplicate-version errors from real failures
      const jobs = workflow!['jobs'] as Record<string, Record<string, unknown>>
      const steps = jobs['publish']['steps'] as Array<Record<string, unknown>>
      const publishStep = steps.find(
        (step) => typeof step['run'] === 'string' && (step['run'] as string).includes('npm publish'),
      )
      expect(publishStep).toBeDefined()
      const runCommand = publishStep!['run'] as string
      // Must check specifically for duplicate-version error message
      expect(runCommand).toContain('Cannot publish over the previously published versions')
      // Must NOT use blanket error suppression like "|| true"
      expect(runCommand).not.toContain('|| true')
    })
  })
})
