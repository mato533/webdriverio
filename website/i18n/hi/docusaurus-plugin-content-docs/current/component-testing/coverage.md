---
id: coverage
title: कवरेज
---

WebdriverIO [`istanbul`](https://istanbul.js.org/)के माध्यम से परीक्षण कवरेज रिपोर्टिंग का समर्थन करता है। The testrunner will automatically instrument your code and capture code coverage for you.

## स्थापित करना

कोड कवरेज रिपोर्टिंग सक्षम करने के लिए, इसे WebdriverIO ब्राउज़र रनर कॉन्फ़िगरेशन के माध्यम से सक्षम करें, उदाहरण के लिए:

```js title=wdio.conf.js
export const config = {
    // ...
    runner: ['browser', {
        preset: process.env.WDIO_PRESET,
        coverage: {
            enabled: true
        }
    }],
    // ...
}
```

सभी [कवरेज विकल्प](/docs/runner#coverage-options)चेकआउट करें, यह जानने के लिए कि इसे ठीक से कैसे कॉन्फ़िगर किया जाए।

## कोड की उपेक्षा

आपके कोडबेस के कुछ खंड हो सकते हैं जिन्हें आप जानबूझकर कवरेज ट्रैकिंग से बाहर करना चाहते हैं, ऐसा करने के लिए आप निम्नलिखित पार्सिंग संकेतों का उपयोग कर सकते हैं:

- `/* istanbul ignore if */`अगले if स्टेटमेंट को इग्नोर करें।
- `/* istanbul ignore else */`:: if स्टेटमेंट के दूसरे हिस्से को इग्नोर करें।
- `/* istanbul ignore next */`: i सोर्स-कोड में अगली चीज को इग्नोर करें (फंक्शंस, इफ स्टेटमेंट्स, क्लासेज, आप इसे नाम दें)।
- `/* istanbul ignore file */`:>: संपूर्ण स्रोत-फ़ाइल को अनदेखा करें (इसे फ़ाइल के शीर्ष पर रखा जाना चाहिए)।

:::info

आपकी परीक्षण फ़ाइलों को कवरेज रिपोर्टिंग से बाहर करने की अनुशंसा की जाती है क्योंकि यह त्रुटियों का कारण बन सकती है, उदाहरण के लिए `execute` या `executeAsync` कमांड निष्पादित करें। यदि आप उन्हें अपनी रिपोर्ट में रखना चाहते हैं, तो सुनिश्चित करें कि आप निम्न के माध्यम से उनका उपकरण बहिष्कृत करें:

```ts
await browser.execute(/* istanbul ignore next */() => {
    // ...
})
```

:::
