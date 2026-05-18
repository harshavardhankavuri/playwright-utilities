// ─────────────────────────────────────────────────────────────────────────────
// Jenkins Pipeline — Playwright E2E Tests
// ─────────────────────────────────────────────────────────────────────────────
// Configurable parameters for environment, browser, workers, retries, etc.
//
// Usage:
//   - Trigger manually with parameters from Jenkins UI
//   - Or trigger via webhook on push/PR
//
// Prerequisites:
//   - Node.js 20+ installed on agent (or use docker agent)
//   - Java installed (for Allure report generation)
//   - Allure CLI installed (or use npm allure-commandline)
// ─────────────────────────────────────────────────────────────────────────────

pipeline {
    agent any

    parameters {
        choice(
            name: 'ENVIRONMENT',
            choices: ['dev', 'qa', 'staging', 'prod'],
            description: 'Target environment for tests'
        )
        choice(
            name: 'PROJECT',
            choices: ['chromium', 'firefox', 'webkit', 'all'],
            description: 'Browser project to run'
        )
        string(
            name: 'WORKERS',
            defaultValue: '4',
            description: 'Number of parallel workers'
        )
        string(
            name: 'RETRIES',
            defaultValue: '2',
            description: 'Number of retries for failed tests'
        )
        string(
            name: 'TAGS',
            defaultValue: '',
            description: 'Test tags to filter (e.g. @smoke, @regression)'
        )
        string(
            name: 'SHARD',
            defaultValue: '',
            description: 'Shard index (e.g. 1/3 for first of 3 shards)'
        )
        choice(
            name: 'REPORT_MODE',
            choices: ['full', 'single'],
            description: 'Report mode: full (with traces) or single (clean HTML)'
        )
        booleanParam(
            name: 'XRAY_ENABLED',
            defaultValue: false,
            description: 'Push results to X-Ray (Jira)'
        )
        booleanParam(
            name: 'XRAY_CREATE_EXECUTION',
            defaultValue: false,
            description: 'Create a new Test Execution in Jira'
        )
        string(
            name: 'XRAY_EXECUTION_KEY',
            defaultValue: '',
            description: 'Existing X-Ray execution key (skip creation)'
        )
        string(
            name: 'BASE_URL',
            defaultValue: '',
            description: 'Override base URL (leave empty to use env default)'
        )
    }

    environment {
        CI = 'true'
        ENV = "${params.ENVIRONMENT}"
        REPORT_MODE = "${params.REPORT_MODE}"
        XRAY_ENABLED = "${params.XRAY_ENABLED}"
        XRAY_FEATURE_CREATE_EXECUTION = "${params.XRAY_CREATE_EXECUTION}"
        XRAY_FEATURE_UPDATE_STATUS = "${params.XRAY_ENABLED}"
        XRAY_FEATURE_ATTACH_SCREENSHOTS = "${params.XRAY_ENABLED}"
        XRAY_EXECUTION_KEY = "${params.XRAY_EXECUTION_KEY}"
        // Credentials from Jenkins credential store
        JIRA_BASE_URL = credentials('jira-base-url')
        JIRA_PROJECT_KEY = credentials('jira-project-key')
        JIRA_EMAIL = credentials('jira-email')
        JIRA_API_TOKEN = credentials('jira-api-token')
        BROWSERSTACK_USERNAME = credentials('browserstack-username')
        BROWSERSTACK_ACCESS_KEY = credentials('browserstack-access-key')
    }

    tools {
        nodejs 'Node-20'  // Configure in Jenkins Global Tool Configuration
    }

    stages {
        stage('Install') {
            steps {
                sh 'npm ci'
                script {
                    def browsers = params.PROJECT == 'all' ? '' : params.PROJECT
                    sh "npx playwright install --with-deps ${browsers}"
                }
            }
        }

        stage('Test') {
            steps {
                script {
                    def args = []

                    // Project
                    if (params.PROJECT != 'all') {
                        args.add("--project=${params.PROJECT}")
                    }

                    // Workers
                    args.add("--workers=${params.WORKERS}")

                    // Retries
                    args.add("--retries=${params.RETRIES}")

                    // Shard
                    if (params.SHARD?.trim()) {
                        args.add("--shard=${params.SHARD}")
                    }

                    // Tags
                    if (params.TAGS?.trim()) {
                        args.add("--grep=\"${params.TAGS}\"")
                    }

                    // Base URL override
                    def baseUrlEnv = params.BASE_URL?.trim() ? "BASE_URL=${params.BASE_URL}" : ''

                    sh "${baseUrlEnv} npx playwright test ${args.join(' ')}"
                }
            }
            post {
                always {
                    // Archive test artifacts
                    archiveArtifacts artifacts: 'allure-results/**', allowEmptyArchive: true
                    archiveArtifacts artifacts: 'test-results/**', allowEmptyArchive: true
                }
            }
        }

        stage('Report') {
            steps {
                script {
                    if (params.REPORT_MODE == 'single') {
                        sh 'node scripts/allure-single.js'
                    } else {
                        sh 'npx allure generate allure-results --clean -o reports/allure'
                    }
                }
            }
            post {
                always {
                    // Publish Allure report (requires Allure Jenkins Plugin)
                    allure includeProperties: false, results: [[path: 'allure-results']]

                    // Archive HTML report
                    archiveArtifacts artifacts: 'reports/**', allowEmptyArchive: true
                }
            }
        }
    }

    post {
        always {
            cleanWs()
        }
        failure {
            // Notify on failure (configure as needed)
            echo 'Tests failed! Check the Allure report for details.'
        }
        success {
            echo 'All tests passed!'
        }
    }
}
