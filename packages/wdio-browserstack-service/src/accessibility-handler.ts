import util from 'node:util'

import type { Capabilities, Frameworks, Options } from '@wdio/types'

import type { BrowserstackConfig, BrowserstackOptions } from './types.js'

import type { ITestCaseHookParameter } from './cucumber-types.js'

import Listener from './testOps/listener.js'

import {
    getA11yResultsSummary,
    getAppA11yResultsSummary,
    getA11yResults,
    performA11yScan,
    getUniqueIdentifier,
    getUniqueIdentifierForCucumber,
    isAccessibilityAutomationSession,
    isAppAccessibilityAutomationSession,
    isBrowserstackSession,
    o11yClassErrorHandler,
    shouldScanTestForAccessibility,
    validateCapsWithA11y,
    shouldAddServiceVersion,
    validateCapsWithNonBstackA11y,
    isTrue,
    validateCapsWithAppA11y,
    getAppA11yResults,
    executeAccessibilityScript
} from './util.js'
import accessibilityScripts from './scripts/accessibility-scripts.js'
import PerformanceTester from './instrumentation/performance/performance-tester.js'
import * as PERFORMANCE_SDK_EVENTS from './instrumentation/performance/constants.js'

import { BStackLogger } from './bstackLogger.js'

class _AccessibilityHandler {
    private _platformA11yMeta: { [key: string]: unknown; }
    private _caps: Capabilities.ResolvedTestrunnerCapabilities
    private _suiteFile?: string
    private _accessibility?: boolean
    private _turboscale?: boolean
    private _options: BrowserstackConfig & BrowserstackOptions
    private _config: Options.Testrunner
    private _accessibilityOptions?: { [key: string]: unknown; }
    private _testMetadata: { [key: string]: unknown; } = {}
    private static _a11yScanSessionMap: { [key: string]: unknown; } = {}
    private _sessionId: string | null = null
    private listener = Listener.getInstance()

    constructor (
        private _browser: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser,
        _capabilities: Capabilities.ResolvedTestrunnerCapabilities,
        _options : BrowserstackConfig & BrowserstackOptions,
        private isAppAutomate: boolean,
        _config : Options.Testrunner,
        private _framework?: string,
        _accessibilityAutomation?: boolean | string,
        _turboscale?: boolean | string,
        _accessibilityOpts?: { [key: string]: unknown; }
    ) {
        const caps = (this._browser as WebdriverIO.Browser).capabilities as WebdriverIO.Capabilities

        this._platformA11yMeta = {
            browser_name: caps.browserName,
            // @ts-expect-error invalid caps property
            browser_version: caps?.browserVersion || (caps as WebdriverIO.Capabilities)?.version || 'latest',
            platform_name: caps?.platformName,
            platform_version: this._getCapabilityValue(caps, 'appium:platformVersion', 'platformVersion'),
            os_name: this._getCapabilityValue(_capabilities, 'os', 'os'),
            os_version: this._getCapabilityValue(_capabilities, 'osVersion', 'os_version')
        }

        this._caps = _capabilities
        this._accessibility = isTrue(_accessibilityAutomation)
        this._accessibilityOptions = _accessibilityOpts
        this._options = _options
        this._config= _config
        this._turboscale = isTrue(_turboscale)
    }

    setSuiteFile(filename: string) {
        this._suiteFile = filename
    }

    _getCapabilityValue(caps: Capabilities.ResolvedTestrunnerCapabilities, capType: string, legacyCapType: string) {
        if (caps) {
            if (capType === 'accessibility') {
                if ((caps as WebdriverIO.Capabilities)['bstack:options'] && (isTrue((caps as WebdriverIO.Capabilities)['bstack:options']?.accessibility))) {
                    return (caps as WebdriverIO.Capabilities)['bstack:options']?.accessibility
                } else if (isTrue((caps as WebdriverIO.Capabilities)['browserstack.accessibility'])) {
                    return (caps as WebdriverIO.Capabilities)['browserstack.accessibility']
                }
            } else if (capType === 'deviceName') {
                if ((caps as WebdriverIO.Capabilities)['bstack:options'] && (caps as WebdriverIO.Capabilities)['bstack:options']?.deviceName) {
                    return (caps as WebdriverIO.Capabilities)['bstack:options']?.deviceName
                } else if ((caps as WebdriverIO.Capabilities)['bstack:options'] && (caps as WebdriverIO.Capabilities)['bstack:options']?.device) {
                    return (caps as WebdriverIO.Capabilities)['bstack:options']?.device
                } else if ((caps as WebdriverIO.Capabilities)['appium:deviceName']) {
                    return (caps as WebdriverIO.Capabilities)['appium:deviceName']
                }
            } else if (capType === 'goog:chromeOptions' && (caps as WebdriverIO.Capabilities)['goog:chromeOptions']) {
                return (caps as WebdriverIO.Capabilities)['goog:chromeOptions']
            } else {
                const bstackOptions = (caps as WebdriverIO.Capabilities)['bstack:options']
                if ( bstackOptions && bstackOptions?.[capType as keyof Capabilities.BrowserStackCapabilities]) {
                    return bstackOptions?.[capType as keyof Capabilities.BrowserStackCapabilities]
                } else if ((caps as WebdriverIO.Capabilities)[legacyCapType as keyof WebdriverIO.Capabilities]) {
                    return (caps as WebdriverIO.Capabilities)[legacyCapType as keyof WebdriverIO.Capabilities]
                }
            }
        }
    }

    async before (sessionId: string) {
        this._sessionId = sessionId
        this._accessibility = isTrue(this._getCapabilityValue(this._caps, 'accessibility', 'browserstack.accessibility'))

        //checks for running ALLY on non-bstack infra
        if (
            isAccessibilityAutomationSession(this._accessibility) &&
            (
                this._turboscale ||
                !shouldAddServiceVersion(this._config, this._options.testObservability)
            ) &&
            validateCapsWithNonBstackA11y(
                this._platformA11yMeta.browser_name as string,
                this._platformA11yMeta?.browser_version as string
            )
        ){
            this._accessibility = true
        } else {
            if (isAccessibilityAutomationSession(this._accessibility) && !this.isAppAutomate) {
                const deviceName = this._getCapabilityValue(this._caps, 'deviceName', 'device')
                const chromeOptions = this._getCapabilityValue(this._caps, 'goog:chromeOptions', '') as Capabilities.ChromeOptions

                this._accessibility = validateCapsWithA11y(deviceName as string, this._platformA11yMeta as unknown as Record<string, string>, chromeOptions)
            }
            if (isAppAccessibilityAutomationSession(this._accessibility, this.isAppAutomate)) {
                this._accessibility = validateCapsWithAppA11y(this._platformA11yMeta)
            }
        }

        (this._browser as WebdriverIO.Browser).getAccessibilityResultsSummary = async () => {
            if (isAppAccessibilityAutomationSession(this._accessibility, this.isAppAutomate)) {
                return await getAppA11yResultsSummary(this.isAppAutomate, (this._browser as WebdriverIO.Browser), isBrowserstackSession(this._browser), this._accessibility, this._sessionId)
            }
            return await getA11yResultsSummary(this.isAppAutomate, (this._browser as WebdriverIO.Browser), isBrowserstackSession(this._browser), this._accessibility)
        }

        (this._browser as WebdriverIO.Browser).getAccessibilityResults = async () => {
            if (isAppAccessibilityAutomationSession(this._accessibility, this.isAppAutomate)) {
                return await getAppA11yResults(this.isAppAutomate, (this._browser as WebdriverIO.Browser), isBrowserstackSession(this._browser), this._accessibility, this._sessionId)
            }
            return await getA11yResults(this.isAppAutomate, (this._browser as WebdriverIO.Browser), isBrowserstackSession(this._browser), this._accessibility)
        }

        (this._browser as WebdriverIO.Browser).performScan = async () => {
            return await performA11yScan(this.isAppAutomate, (this._browser as WebdriverIO.Browser), isBrowserstackSession(this._browser), this._accessibility)
        }

        if (!this._accessibility) {
            return
        }
        if (!('overwriteCommand' in this._browser && Array.isArray(accessibilityScripts.commandsToWrap))) {
            return
        }

        accessibilityScripts.commandsToWrap
            .filter((command) => command.name && command.class)
            .forEach((command) => {
                const browser = this._browser as WebdriverIO.Browser
                try {
                    // @ts-expect-error fix type
                    browser.overwriteCommand(command.name, this.commandWrapper.bind(this, command), command.class === 'Element')
                } catch (error) {
                    BStackLogger.debug(`Exception in overwrite command ${command.name} - ${error}`)
                }
            })
    }

    async beforeTest (suiteTitle: string | undefined, test: Frameworks.Test) {
        try {
            if (
                this._framework !== 'mocha' ||
                !this.shouldRunTestHooks(this._browser, this._accessibility)
            ) {
                /* This is to be used when test events are sent */
                Listener.setTestRunAccessibilityVar(false)
                return
            }

            // @ts-expect-error fix type
            const shouldScanTest = shouldScanTestForAccessibility(suiteTitle, test.title, this._accessibilityOptions)
            const testIdentifier = this.getIdentifier(test)

            if (this._sessionId) {
                /* For case with multiple tests under one browser, before hook of 2nd test should change this map value */
                AccessibilityHandler._a11yScanSessionMap[this._sessionId] = shouldScanTest
            }

            /* This is to be used when test events are sent */
            Listener.setTestRunAccessibilityVar(this._accessibility && shouldScanTest)

            this._testMetadata[testIdentifier] = {
                scanTestForAccessibility : shouldScanTest,
                accessibilityScanStarted : true
            }

            // @ts-expect-error fix type
            this._testMetadata[testIdentifier].accessibilityScanStarted = shouldScanTest

            if (shouldScanTest) {
                BStackLogger.info('Automate test case execution has started.')
            }
        } catch (error) {
            BStackLogger.error(`Exception in starting accessibility automation scan for this test case ${error}`)
        }
    }

    async afterTest (suiteTitle: string | undefined, test: Frameworks.Test) {
        BStackLogger.debug('Accessibility after test hook. Before sending test stop event')
        if (
            this._framework !== 'mocha' ||
            !this.shouldRunTestHooks(this._browser, this._accessibility)
        ) {
            return
        }

        try {
            const testIdentifier = this.getIdentifier(test)
            // @ts-expect-error fix type
            const accessibilityScanStarted = this._testMetadata[testIdentifier]?.accessibilityScanStarted
            // @ts-expect-error fix type
            const shouldScanTestForAccessibility = this._testMetadata[testIdentifier]?.scanTestForAccessibility

            if (!accessibilityScanStarted) {
                return
            }

            if (shouldScanTestForAccessibility) {
                BStackLogger.info('Automate test case execution has ended. Processing for accessibility testing is underway. ')

                const dataForExtension = {
                    'thTestRunUuid': process.env.TEST_ANALYTICS_ID,
                    'thBuildUuid': process.env.BROWSERSTACK_TESTHUB_UUID,
                    'thJwtToken': process.env.BROWSERSTACK_TESTHUB_JWT
                }

                await this.sendTestStopEvent((this._browser as WebdriverIO.Browser), dataForExtension)

                BStackLogger.info('Accessibility testing for this test case has ended.')
            }
        } catch (error) {
            BStackLogger.error(`Accessibility results could not be processed for the test case ${test.title}. Error : ${error}`)
        }
    }

    /**
      * Cucumber Only
    */
    async beforeScenario (world: ITestCaseHookParameter) {
        const pickleData = world.pickle
        const gherkinDocument = world.gherkinDocument
        const featureData = gherkinDocument.feature
        const uniqueId = getUniqueIdentifierForCucumber(world)
        if (!this.shouldRunTestHooks(this._browser, this._accessibility)) {
            /* This is to be used when test events are sent */
            Listener.setTestRunAccessibilityVar(false)
            return
        }

        try {
            // @ts-expect-error fix type
            const shouldScanScenario = shouldScanTestForAccessibility(featureData?.name, pickleData.name, this._accessibilityOptions, world, true)
            this._testMetadata[uniqueId] = {
                scanTestForAccessibility : shouldScanScenario,
                accessibilityScanStarted : true
            }

            // @ts-expect-error fix type
            this._testMetadata[uniqueId].accessibilityScanStarted = shouldScanScenario
            if (this._sessionId) {
                /* For case with multiple tests under one browser, before hook of 2nd test should change this map value */
                AccessibilityHandler._a11yScanSessionMap[this._sessionId] = shouldScanScenario
            }

            /* This is to be used when test events are sent */
            Listener.setTestRunAccessibilityVar(this._accessibility && shouldScanScenario)

            if (shouldScanScenario) {
                BStackLogger.info('Automate test case execution has started.')
            }
        } catch (error) {
            BStackLogger.error(`Exception in starting accessibility automation scan for this test case ${error}`)
        }
    }

    async afterScenario (world: ITestCaseHookParameter) {
        BStackLogger.debug('Accessibility after scenario hook. Before sending test stop event')
        if (!this.shouldRunTestHooks(this._browser, this._accessibility)) {
            return
        }

        const pickleData = world.pickle
        try {
            const uniqueId = getUniqueIdentifierForCucumber(world)
            // @ts-expect-error fix type
            const accessibilityScanStarted = this._testMetadata[uniqueId]?.accessibilityScanStarted
            // @ts-expect-error fix type
            const shouldScanTestForAccessibility = this._testMetadata[uniqueId]?.scanTestForAccessibility

            if (!accessibilityScanStarted) {
                return
            }

            if (shouldScanTestForAccessibility) {
                BStackLogger.info('Automate test case execution has ended. Processing for accessibility testing is underway. ')

                const dataForExtension = {
                    'thTestRunUuid': process.env.TEST_ANALYTICS_ID,
                    'thBuildUuid': process.env.BROWSERSTACK_TESTHUB_UUID,
                    'thJwtToken': process.env.BROWSERSTACK_TESTHUB_JWT
                }

                await this.sendTestStopEvent(( this._browser as WebdriverIO.Browser), dataForExtension)

                BStackLogger.info('Accessibility testing for this test case has ended.')
            }
        } catch (error) {
            BStackLogger.error(`Accessibility results could not be processed for the test case ${pickleData.name}. Error : ${error}`)
        }
    }

    /*
     * private methods
     */

    private async commandWrapper (command: { name: string, class: string }, origFunction: Function, ...args: string[]) {
        if (
            this._sessionId && AccessibilityHandler._a11yScanSessionMap[this._sessionId] &&
                (
                    !command.name.includes('execute') ||
                    !AccessibilityHandler.shouldPatchExecuteScript(args.length ? args[0] : null)
                )
        ) {
            BStackLogger.debug(`Performing scan for ${command.class} ${command.name}`)
            await performA11yScan(this.isAppAutomate, this._browser, true, true, command.name)
        }
        return origFunction(...args)
    }

    private async sendTestStopEvent(browser: WebdriverIO.Browser, dataForExtension: unknown) {
        BStackLogger.debug('Performing scan before saving results')
        await PerformanceTester.measureWrapper(PERFORMANCE_SDK_EVENTS.A11Y_EVENTS.PERFORM_SCAN, async () => {
            await performA11yScan(this.isAppAutomate, browser, true, true)
        }, { command: 'afterTest' })()

        if (isAppAccessibilityAutomationSession(this._accessibility, this.isAppAutomate)) {
            return
        }

        await PerformanceTester.measureWrapper(PERFORMANCE_SDK_EVENTS.A11Y_EVENTS.SAVE_RESULTS, async () => {
            if (accessibilityScripts.saveTestResults) {
                const results: unknown = await executeAccessibilityScript(browser, accessibilityScripts.saveTestResults, dataForExtension)
                BStackLogger.debug(util.format(results as string))
            } else {
                BStackLogger.error('saveTestResults script is null or undefined')
            }
        })()

    }

    private getIdentifier (test: Frameworks.Test | ITestCaseHookParameter) {
        if ('pickle' in test) {
            return getUniqueIdentifierForCucumber(test)
        }
        return getUniqueIdentifier(test, this._framework)
    }

    private shouldRunTestHooks(browser: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser, isAccessibility?: boolean | string) {
        if (!browser) {
            return false
        }
        return isAccessibilityAutomationSession(isAccessibility)
    }

    private async checkIfPageOpened(browser: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser, testIdentifier: string, shouldScanTest?: boolean) {
        let pageOpen = false
        this._testMetadata[testIdentifier] = {
            scanTestForAccessibility : shouldScanTest,
            accessibilityScanStarted : true
        }

        try {
            const currentURL = await (browser as WebdriverIO.Browser).getUrl()
            const url = new URL(currentURL)
            pageOpen = url?.protocol === 'http:' || url?.protocol === 'https:'
        } catch {
            pageOpen = false
        }

        return pageOpen
    }

    private static shouldPatchExecuteScript(script: string | null): boolean {
        if (!script || typeof script !== 'string') {
            return true
        }

        return (
            script.toLowerCase().indexOf('browserstack_executor') !== -1 ||
            script.toLowerCase().indexOf('browserstack_accessibility_automation_script') !== -1
        )
    }
}

// https://github.com/microsoft/TypeScript/issues/6543
const AccessibilityHandler: typeof _AccessibilityHandler = o11yClassErrorHandler(_AccessibilityHandler)
type AccessibilityHandler = _AccessibilityHandler

export default AccessibilityHandler

