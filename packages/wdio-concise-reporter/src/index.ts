import { getBrowserName, type SuiteStats, type RunnerStats } from '@wdio/reporter'
import WDIOReporter from '@wdio/reporter'
import chalk from 'chalk'

import type { Reporters } from '@wdio/types'

export default class ConciseReporter extends WDIOReporter {
    // keep track of the order that suites were called
    private _suiteUids: string[] = []
    private _suites: SuiteStats[] = []
    private _stateCounts = { failed: 0 }

    constructor(options: Reporters.Options) {
        // write to output stream by default
        super(Object.assign({ stdout: true }, options))
    }

    onSuiteStart (suite: SuiteStats): void {
        this._suiteUids.push(suite.uid)
    }

    onSuiteEnd (suite: SuiteStats): void {
        this._suites.push(suite)
    }

    onTestFail () {
        this._stateCounts.failed++
    }

    onRunnerEnd (runner: RunnerStats): void {
        this.printReport(runner)
    }

    /**
     * Print the Concise report to the screen
     * @param  {Object} runner Wdio runner
     */
    printReport(runner: RunnerStats): void {
        const header = chalk.yellow('========= Your concise report ==========')

        const output = [
            this.getEnviromentCombo(runner.capabilities),
            this.getCountDisplay(),
            ...this.getFailureDisplay()
        ]

        this.write(`${header}\n${output.join('\n')}\n`)
    }

    /**
     * Get the display for failing tests
     * @return {String} Count display
     */
    getCountDisplay () {
        const failedTestsCount = this._stateCounts.failed
        return failedTestsCount > 0
            ? `❌ Test${failedTestsCount > 1 ? 's' : ''} failed (${failedTestsCount}):`
            : this.counts.tests === 0
                ? '❌ Failed to setup tests, no tests found'
                : '✅ All went well!'
    }

    /**
     * Get display for failed tests, e.g. stack trace
     * @return {Array} Stack trace output
     */
    getFailureDisplay () {
        const output: string[] = []

        this.getOrderedSuites().map(suite => suite.tests.map(test => {
            if (test.state === 'failed') {
                output.push(
                    `  Fail : ${chalk.red(test.title)}`,
                    // @ts-ignore
                    `    ${test.error.type} : ${chalk.yellow(test.error?.message)}`
                )
            }
        }))

        return output
    }

    /**
     * Get suites in the order they were called
     * @return {Array} Ordered suites
     */
    getOrderedSuites () {
        const orderedSuites: SuiteStats[] = []

        this._suiteUids.map(uid => this._suites.map(suite => {
            if (suite.uid === uid) {
                orderedSuites.push(suite)
            }
        }))

        return orderedSuites
    }

    /**
     * Get information about the enviroment
     * @param  {Object}  caps    Enviroment details
     * @param  {Boolean} verbose
     * @return {String}          Enviroment string
     */
    getEnviromentCombo (caps: WebdriverIO.Capabilities) {
        // @ts-expect-error `deviceName` and `device` are outdated JSONWP caps
        const device = caps.deviceName || caps['appium:deviceName'] || caps.device
        const browser = getBrowserName(caps)
        // @ts-expect-error `version` and `browser_version` are outdated JSONWP caps
        const version = caps.browserVersion || caps.version || caps['appium:platformVersion'] || caps.browser_version
        // @ts-expect-error `os`, `os_version` and `platform` are outdated JSONWP caps
        const platform = caps.os ? (caps.os + ' ' + caps.os_version) : (caps.platform || caps.platformName)

        // mobile capabilities
        if (device) {
            const program = (caps['appium:app'] || '').replace('sauce-storage:', '') || caps.browserName
            const executing = program ? `executing ${program}` : ''

            return `${device} on ${platform} ${version} ${executing}`.trim()
        }

        return browser
            + (version ? ` (v${version})` : '')
            + (platform ? ` on ${platform}` : '')
    }
}
