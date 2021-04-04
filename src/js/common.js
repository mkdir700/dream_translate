'use strict'

/**
 * Dream Translate
 * https://github.com/ryanker/dream_translate
 * @Author Ryan <dream39999@gmail.com>
 * @license MIT License
 */

/*!
 * 浏览器统一兼容
 * 参考：
 * https://github.com/mozilla/webextension-polyfill
 * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities
 * https://developer.chrome.com/docs/extensions/reference/
 * https://crxdoc-zh.appspot.com/extensions/
 */
const isDebug = true
window.isFirefox = navigator.userAgent.includes("Firefox")
// window.isFirefox = typeof browser !== "undefined" && Object.getPrototypeOf(browser) === Object.prototype
const B = {
    extension: chrome.extension,
    getBackgroundPage: chrome.extension.getBackgroundPage,
    windows: chrome.windows,
    commands: chrome.commands,
    runtime: chrome.runtime,
    id: chrome.runtime.id,
    root: chrome.runtime.getURL(''),
    onMessage: chrome.runtime.onMessage,
    sendMessage: chrome.runtime.sendMessage,
    storage: chrome.storage,
    browserAction: chrome.browserAction,
    contextMenus: chrome.contextMenus,
    webRequest: chrome.webRequest,
    cookies: chrome.cookies,
    tabs: chrome.tabs,
    tts: chrome.tts,
    app: chrome.app,
}
String.prototype.format = function () {
    let args = arguments
    return this.replace(/{(\d+)}/g, function (match, number) {
        return typeof args[number] != 'undefined' ? args[number] : match
    })
}

function storageLocalGet(options) {
    return storage('local', 'get', options)
}

function storageLocalSet(options) {
    return storage('local', 'set', options)
}

function storageSyncGet(options) {
    return storage('sync', 'get', options)
}

function storageSyncSet(options) {
    return storage('sync', 'set', options)
}

function storageShowAll() {
    if (!isDebug) return
    !isFirefox && storageSyncGet(null).then(function (r) {
        debug(`all sync storage:`, r)
    })
    storageLocalGet(null).then(function (r) {
        debug(`all local storage:`, r)
    })
}

function storage(type, method, options) {
    return new Promise((resolve, reject) => {
        if (!isFirefox) {
            if (typeof B.app.isInstalled === 'undefined') return reject('The extension has been updated!')
            let callback = function (r) {
                let err = B.runtime.lastError
                err ? reject(err) : resolve(r)
            }
            let api = type === 'sync' ? B.storage.sync : B.storage.local
            if (method === 'get') {
                api.get(options, callback)
            } else if (method === 'set') {
                api.set(options, callback)
            }
        } else {
            let api = isDebug ? browser.storage.local : type === 'sync' ? browser.storage.sync : browser.storage.local
            if (method === 'get') {
                api.get(options).then(r => resolve(r), err => reject(err))
            } else if (method === 'set') {
                api.set(options).then(r => resolve(r), err => reject(err))
            }
        }
    })
}

function cookies(method, options) {
    return new Promise((resolve, reject) => {
        if (!isFirefox) {
            if (typeof B.app.isInstalled === 'undefined') return reject('The extension has been updated!')
            let callback = function (r) {
                let err = B.runtime.lastError
                err ? reject(err) : resolve(r)
            }
            if (method === 'get') {
                B.cookies.get(options, callback)
            } else if (method === 'getAll') {
                B.cookies.getAll(options, callback)
            } else if (method === 'set') {
                B.cookies.set(options, callback)
            } else if (method === 'remove') {
                B.cookies.remove(options, callback)
            }
        } else {
            if (method === 'get') {
                browser.cookies.get(options).then(r => resolve(r), err => reject(err))
            } else if (method === 'getAll') {
                browser.cookies.getAll(options).then(r => resolve(r), err => reject(err))
            } else if (method === 'set') {
                browser.cookies.set(options).then(r => resolve(r), err => reject(err))
            } else if (method === 'remove') {
                browser.cookies.remove(options).then(r => resolve(r), err => reject(err))
            }
        }
    })
}

function sendMessage(message) {
    return new Promise((resolve, reject) => {
        if (!isFirefox) {
            if (typeof B.app.isInstalled === 'undefined') return reject('The extension has been updated!')
            B.sendMessage(message, r => B.runtime.lastError ? reject(B.runtime.lastError) : resolve(r))
        } else {
            browser.runtime.sendMessage(message).then(r => resolve(r), err => reject(err))
        }
    })
}

function sendTabMessage(tabId, message) {
    return new Promise((resolve, reject) => {
        if (!isFirefox) {
            if (typeof B.app.isInstalled === 'undefined') return reject('The extension has been updated!')
            tabId && B.tabs.sendMessage(tabId, message, r => B.runtime.lastError ? reject(B.runtime.lastError) : resolve(r))
        } else {
            tabId && browser.tabs.sendMessage(tabId, message).catch(err => debug('send error:', err))
        }
        resolve()
    })
}

function sandFgMessage(id, message) {
    if (id === 'popup') {
        let popup = B.extension.getViews({type: 'popup'})
        if (popup.length > 0) {
            return sendMessage(message)
        } else {
            return Promise.resolve()
        }
    } else {
        return sendTabMessage(id, message)
    }
}

function getActiveTabId() {
    return new Promise((resolve, reject) => {
        if (!isFirefox) {
            B.tabs.query({currentWindow: true, active: true}, tab => {
                resolve(getJSONValue(tab, '0.id')) // todo: 还有优化空间
            })
        } else {
            browser.tabs.query({currentWindow: true, active: true}).then(tab => {
                let tabId = tab[0] && resolve(tab[0].id)
                resolve(tabId)
            }, err => reject(err))
        }
    })
}

function onBeforeSendHeadersAddListener(callback, filter, opt_extraInfoSpec) {
    if (!opt_extraInfoSpec) opt_extraInfoSpec = Object.values(B.webRequest.OnBeforeSendHeadersOptions)
    B.webRequest.onBeforeSendHeaders.addListener(callback, filter, opt_extraInfoSpec)
}

function onBeforeSendHeadersRemoveListener(callback) {
    B.webRequest.onBeforeSendHeaders.removeListener(callback)
}

function requestHeadersFormat(s) {
    let r = []
    let arr = s.split('\n')
    arr && arr.forEach(v => {
        v = v.trim()
        if (!v) return
        let a = v.split(': ')
        if (a.length === 2) r.push({name: a[0].trim(), value: a[1].trim()})
    })
    return r
}

function onBeforeRequestAddListener(callback, filter, extraInfoSpec) {
    if (!extraInfoSpec) {
        extraInfoSpec = ["blocking", "extraHeaders", "requestBody"] // 解决 chrome 审核机制太垃圾，提示没有使用到 webRequestBlocking
        extraInfoSpec = Object.values(B.webRequest.OnBeforeRequestOptions)
    }
    B.webRequest.onBeforeRequest.addListener(callback, filter, extraInfoSpec)
}

function onBeforeRequestRemoveListener(callback) {
    B.webRequest.onBeforeRequest.removeListener(callback)
}

function onHeadersReceivedAddListener(callback, filter, extraInfoSpec) {
    if (!extraInfoSpec) extraInfoSpec = Object.values(B.webRequest.OnHeadersReceivedOptions)
    B.webRequest.onHeadersReceived.addListener(callback, filter, extraInfoSpec)
}

function onHeadersReceivedRemoveListener(callback) {
    B.webRequest.onHeadersReceived.removeListener(callback)
}

function onCompletedAddListener(callback, filter, extraInfoSpec) {
    if (!extraInfoSpec) extraInfoSpec = Object.values(B.webRequest.OnCompletedOptions)
    B.webRequest.onCompleted.addListener(callback, filter, extraInfoSpec)
}

function onCompletedRemoveListener(callback) {
    B.webRequest.onCompleted.removeListener(callback)
}

function onRemoveFrame(details) {
    let headers = Object.assign([], details.responseHeaders)
    for (let i = 0; i < headers.length; i++) {
        if (headers[i].name.toLowerCase().includes('frame-options')) {
            headers.splice(i, 1)
            break
        }
    }
    return {responseHeaders: headers}
}

// 获得所有语音的列表 (firefox 不支持)
function getVoices() {
    return new Promise((resolve, reject) => {
        if (!B.tts || !B.tts.getVoices) return reject("I won't support it!")

        B.tts.getVoices(function (voices) {
            let list = {}
            for (let i = 0; i < voices.length; i++) {
                // debug('Voice ' + i + ':', JSON.stringify(voices[i]))
                let v = voices[i]
                if (!list[v.lang]) list[v.lang] = []
                list[v.lang].push({lang: v.lang, voiceName: v.voiceName, remote: v.remote})
            }
            resolve(list)
        })
    })
}

function getTimestamp() {
    return Date.parse(new Date() + '') / 1000
}

function addClass(el, className) {
    if (!el || !className) return
    className = className.trim()
    let oldClassName = el.className.trim()
    if (!oldClassName) {
        el.className = className
    } else if (` ${oldClassName} `.indexOf(` ${className} `) === -1) {
        el.className += ' ' + className
    }
}

function rmClass(el, className) {
    if (!el.className) return
    className = className.trim()
    let newClassName = el.className.trim()
    if ((` ${newClassName} `).indexOf(` ${className} `) === -1) return
    newClassName = newClassName.replace(new RegExp('(?:^|\\s)' + className + '(?:\\s|$)', 'g'), ' ').trim()
    if (newClassName) {
        el.className = newClassName
    } else {
        el.removeAttribute('class')
    }
}

function hasClass(el, className) {
    if (!el.className) return false
    return (` ${el.className.trim()} `).indexOf(` ${className.trim()} `) > -1
}

function sleep(delay) {
    return new Promise(r => setTimeout(r, delay))
}

function getDate(value, isDate) {
    let d = value ? new Date(value) : new Date()
    d.setMinutes(-d.getTimezoneOffset() + d.getMinutes(), d.getSeconds(), 0)
    let s = d.toISOString()
    if (isDate) {
        s = s.substring(0, 10)
    } else {
        s = s.replace('T', ' ')
        s = s.replace('.000Z', '')
    }
    return s
}

// 补零
function zero(value, digits) {
    digits = digits || 2
    let isNegative = Number(value) < 0
    let s = value.toString()
    if (isNegative) s = s.slice(1)
    let size = digits - s.length + 1
    s = new Array(size).join('0').concat(s)
    return (isNegative ? '-' : '') + s
}

function $(id) {
    return document.getElementById(id)
}

function N(id) {
    return document.getElementsByName(id)
}

function S(s) {
    return document.querySelector(s)
}

function D(s) {
    return document.querySelectorAll(s)
}

function onD(el, type, listener, options) {
    el.forEach(v => {
        v.addEventListener(type, listener, options)
    })
}

function unD(el, type, listener, options) {
    el.forEach(v => {
        v.removeEventListener(type, listener, options)
    })
}

function removeD(el) {
    el.forEach(e => e.remove())
}

function rmClassD(el, className) {
    el.forEach(v => rmClass(v, className))
}

function inArray(val, arr) {
    // return arr.indexOf(val) !== -1
    return arr.includes(val)
}

function isObject(o) {
    return Object.prototype.toString.call(o) === '[object Object]'
}

function isArray(o) {
    return Object.prototype.toString.call(o) === '[object Array]'
}

function isString(o) {
    return Object.prototype.toString.call(o) === '[object String]'
}

function isNumber(o) {
    return Object.prototype.toString.call(o) === '[object Number]'
}

function isDate(o) {
    return Object.prototype.toString.call(o) === '[object Date]'
}

function isRegExp(o) {
    return Object.prototype.toString.call(o) === '[object RegExp]'
}

function isError(o) {
    return Object.prototype.toString.call(o) === '[object Error]'
}

function isSymbol(o) {
    return Object.prototype.toString.call(o) === '[object Symbol]'
}

function isArrayBuffer(o) {
    return Object.prototype.toString.call(o) === '[object ArrayBuffer]'
}

function isFunction(o) {
    return Object.prototype.toString.call(o) === '[object Function]'
}

function getSearchList(s) {
    s = s.trim()
    let arr = s.split('\n')
    let r = {}
    for (let v of arr) {
        v = v.trim()
        let a = v.split('|')
        let key = a[0] && a[0].trim()
        let val = a[1] && a[1].trim()
        if (key && val) r[key] = val
    }
    return r
}

// 解决 JSON 太深问题
function getJSONValue(data, keys, value) {
    // if (!data || !isObject(data)) return value // 默认值
    if (!data) return value // 默认值
    keys = keys.trim()
    let arr = keys.split('.')
    let val = Object.assign({}, data)
    for (let key of arr) {
        if (!val[key]) return value // 默认值
        val = val[key]
    }
    return val
}

// 添加 DOM 元素
function addEl(options) {
    let {tagName, id, className, text, title, onClick} = options
    let el = document.createElement(tagName)
    if (id) el.id = id
    if (className) el.className = className
    if (text) el.textContent = text
    if (title) el.title = title
    if (onClick) el.addEventListener('click', onClick)
    return el
}

function createTextarea() {
    let t = document.createElement("textarea")
    t.style.position = 'fixed'
    t.style.top = '-200%'
    document.body.appendChild(t)
    return t
}

function execCopy(s) {
    let t = createTextarea()
    t.value = s
    t.select()
    document.execCommand("copy")
    document.body.removeChild(t)
}

function execPaste() {
    let t = createTextarea()
    t.focus()
    document.execCommand("paste")
    let v = t.value
    document.body.removeChild(t)
    return v
}

// dream alert
function dal(text, type, onSubmit) {
    let icon = {
        info: '<i class="dmx-icon dmx-icon-info"></i>',
        error: '<i class="dmx-icon dmx-icon-close"></i>',
        success: '<i class="dmx-icon dmx-icon-success"></i>',
    }
    D('.dal_bg,.dal').forEach(e => e.remove()) // 只允许存在一个
    document.body.insertAdjacentHTML('beforeend', `<div class="dal_bg"></div>
<div class="dal">
    <div class="dal_modal">
        <div class="dal_text">${(icon[type] || icon.info) + text}</div>
        <div class="dal_foot">
            <button class="dmx_button" data-type="submit">确认</button>
        </div>
    </div>
</div>`)
    let rmFn = () => D('.dal_bg,.dal').forEach(e => e.remove())
    S('[data-type="submit"]').addEventListener('click', rmFn)
    if (typeof onSubmit === 'function') S('[data-type="submit"]').addEventListener('click', onSubmit)
}

// dream confirm
function dco(text, onSubmit, onCancel) {
    D('.dal_bg,.dal').forEach(e => e.remove()) // 只允许存在一个
    document.body.insertAdjacentHTML('beforeend', `<div class="dal_bg"></div>
<div class="dal">
    <div class="dal_modal">
        <div class="dal_text"><i class="dmx-icon dmx-icon-info"></i>${text}</div>
        <div class="dal_foot">
            <button class="dmx_button" data-type="submit">确认</button>
            <button class="dmx_button dmx_button_default" data-type="cancel">取消</button>
        </div>
    </div>
</div>`)
    let submitEl = S('[data-type="submit"]')
    let cancelEl = S('[data-type="cancel"]')
    let rmFn = () => D('.dal_bg,.dal').forEach(e => e.remove())
    submitEl.addEventListener('click', rmFn)
    cancelEl.addEventListener('click', rmFn)
    if (typeof onSubmit === 'function') submitEl.addEventListener('click', onSubmit)
    if (typeof onCancel === 'function') cancelEl.addEventListener('click', onCancel)
}

// dream dialog
function ddi(option) {
    let o = Object.assign({
        title: '',
        body: '',
        fullscreen: false,
        onClose: null,
    }, option || {})
    let el = S('.ddi .ddi_body')
    if (el) {
        el.innerHTML = o.body
    } else {
        document.body.insertAdjacentHTML('beforeend', `<div class="ddi_bg"></div>
<div class="ddi">
    <div class="ddi_modal ddi_dialog${o.fullscreen ? ' fullscreen' : ''}">
        <div class="ddi_head">${o.title}<i class="dmx-icon dmx-icon-close"></i></div>
        <div class="ddi_body">${o.body}</div>
    </div>
</div>`)
        addClass(document.body, 'dmx_overflow_hidden')
        S('.ddi_head .dmx-icon-close').addEventListener('click', () => {
            rmClass(document.body, 'dmx_overflow_hidden')
            removeDdi()
            if (typeof o.onClose === 'function') o.onClose()
        })
    }
}

// remove dream dialog
function removeDdi() {
    rmClass(document.body, 'dmx_overflow_hidden')
    D('.ddi_bg,.ddi').forEach(e => e.remove())
}

function loading(text) {
    document.body.insertAdjacentHTML('beforeend', `<div class="ddi_bg"></div>
<div class="ddi">
    <div class="ddi_loading">
        <div class="ddi_loading_inner"></div>
        <div class="mt_2">${text || 'loading...'}</div>
    </div>
</div>`)
}

// 过滤 HTML，防止XSS
function HTMLEncode(s) {
    let d = document.createElement('div')
    d.textContent = s
    return d.innerHTML || ''
}

function uniqueArray(arr) {
    return [...new Set(arr)]
}

function httpGet(url, type, headers, notStrict) {
    return new Promise((resolve, reject) => {
        let c = new XMLHttpRequest()
        c.responseType = type || 'text'
        c.timeout = 20000
        c.onload = function (e) {
            if (notStrict) {
                resolve(this.response)
            } else {
                if (this.status === 200) {
                    resolve(this.response)
                } else {
                    reject(e)
                }
            }
        }
        c.ontimeout = function (e) {
            reject(e)
        }
        c.onerror = function (e) {
            reject(e)
        }
        c.open("GET", url)
        headers && headers.forEach(v => {
            c.setRequestHeader(v.name, v.value)
        })
        c.send()
    })
}

function httpPost(options) {
    let o = Object.assign({
        url: '',
        responseType: 'json',
        type: 'form',
        body: null,
        timeout: 30000,
        headers: [],
    }, options)
    return new Promise((resolve, reject) => {
        let c = new XMLHttpRequest()
        c.responseType = o.responseType
        c.timeout = o.timeout
        c.onload = function (e) {
            if (this.status === 200 && this.response !== null) {
                resolve(this.response)
            } else {
                reject(e)
            }
        }
        c.ontimeout = function (e) {
            reject(e)
        }
        c.onerror = function (e) {
            reject(e)
        }
        c.open("POST", o.url)
        if (o.type === 'form') {
            c.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
        } else if (o.type === 'json') {
            c.setRequestHeader("Content-Type", "application/json; charset=UTF-8")
        } else if (o.type === 'xml') {
            c.setRequestHeader("Content-Type", "application/ssml+xml")
        }
        o.headers.length > 0 && o.headers.forEach(v => {
            c.setRequestHeader(v.name, v.value)
        })
        c.send(o.body)
    })
}

// 时间范围内，只执行最后一次回调函数
function _setTimeout(tid, callback, timeout) {
    tid = `mx_timeoutId_${tid}`
    _clearTimeout(tid)
    return window[tid] = setTimeout(callback, timeout)
}

function _clearTimeout(tid) {
    let id = window[tid]
    if (id) {
        clearTimeout(id)
        window[tid] = null
    }
}

function debug(...data) {
    isDebug && console.log('[DMX DEBUG]', ...data)
}
