'use strict'

function baiduTranslate() {
    return {
        token: {
            gtk: '',
            token: '',
            date: 0,
        },
        lanTTS: ["en", "zh", "yue", "ara", "kor", "jp", "th", "pt", "spa", "fra", "ru", "de"],
        sign(t, e) {
            var ye = function (t, e) {
                for (var r = 0; r < e.length - 2; r += 3) {
                    var n = e.charAt(r + 2)
                    n = n >= "a" ? n.charCodeAt(0) - 87 : Number(n)
                    n = "+" === e.charAt(r + 1) ? t >>> n : t << n
                    t = "+" === e.charAt(r) ? t + n & 4294967295 : t ^ n
                }
                return t
            }
            var he = '', r = t.length
            r > 30 && (t = "" + t.substr(0, 10) + t.substr(Math.floor(r / 2) - 5, 10) + t.substr(-10, 10))
            var n = ('' !== he ? he : (he = e || "") || "").split("."), o = Number(n[0]) || 0, a = Number(n[1]) || 0
            for (var c = [], i = 0, u = 0; u < t.length; u++) {
                var s = t.charCodeAt(u)
                128 > s ? c[i++] = s : (2048 > s ? c[i++] = s >> 6 | 192 : (55296 === (64512 & s) && u + 1 < t.length && 56320 === (64512 & t.charCodeAt(u + 1)) ?
                    (s = 65536 + ((1023 & s) << 10) + (1023 & t.charCodeAt(++u)), c[i++] = s >> 18 | 240, c[i++] = s >> 12 & 63 | 128) :
                    c[i++] = s >> 12 | 224, c[i++] = s >> 6 & 63 | 128), c[i++] = 63 & s | 128)
            }
            for (var f = o, l = 0; l < c.length; l++) f = ye(f += c[l], "+-a^+6")
            return f = ye(f, "+-3^+b+-f"), 0 > (f ^= a) && (f = 2147483648 + (2147483647 & f)), (f %= 1e6).toString() + "." + (f ^ o)
        },
        init() {
            let str = localStorage.getItem('baiduToken')
            if (str) this.token = JSON.parse(str)
            return this
        },
        setToken(options) {
            this.token = Object.assign(this.token, options)
            localStorage.setItem('baiduToken', JSON.stringify(this.token))
        },
        getToken() {
            return new Promise((resolve, reject) => {
                httpGet('https://fanyi.baidu.com/').then(r => {
                    let arr = r.match(/window\.gtk\s=\s'([^']+)';/)
                    let tArr = r.match(/token:\s'([^']+)'/)
                    if (!arr) reject('baidu gtk empty!')
                    if (!tArr) reject('baidu token empty!')
                    let token = {gtk: arr[1], token: tArr[1], date: Math.floor(Date.now() / 36e5)}
                    this.setToken(token)
                    resolve(token)
                }).catch(e => {
                    reject(e)
                })
            })
        },
        trans(q, srcLan, tarLan) {
            return new Promise((resolve, reject) => {
                if (!this.token.gtk) reject('baidu gtk empty!')
                if (!this.token.token) reject('baidu token empty!')
                let sign = this.sign(q, this.token.gtk)
                let token = this.token.token
                let p = new URLSearchParams(`from=${srcLan}&to=${tarLan}&query=${q}&simple_means_flag=3&sign=${sign}&token=${token}&domain=common`)
                httpPost({
                    url: `https://fanyi.baidu.com/v2transapi?from=${srcLan}&to=${tarLan}`,
                    body: p.toString()
                }).then(r => {
                    if (r) {
                        resolve(this.unify(r, q, srcLan, tarLan))
                    } else {
                        reject('baidu translate error!')
                    }
                }).catch(e => {
                    reject(e)
                })
            })
        },
        unify(r, q, srcLan, tarLan) {
            // console.log('baidu:', r, q, srcLan, tarLan)
            let ret = {text: q, srcLan: srcLan, tarLan: tarLan, lanTTS: this.lanTTS, data: []}
            let arr = r && r.trans_result && r.trans_result.data
            if (arr) {
                arr.forEach(v => {
                    if (v.src && v.dst) ret.data.push({srcText: v.src, tarText: v.dst})
                })
                if (arr.keywords) ret.keywords = arr.keywords
            }
            return ret
        },
        async query(q, srcLan, tarLan, noCache) {
            let t = Math.floor(Date.now() / 36e5)
            let d = this.token.date
            if (noCache || !d || Number(d) !== t) {
                await this.getToken().catch(err => {
                    debug(err)
                })
            }
            if (srcLan === 'auto') {
                srcLan = 'en' // 默认值
                await httpPost({
                    url: `https://fanyi.baidu.com/langdetect`,
                    body: `query=${encodeURIComponent(q)}`
                }).then(r => {
                    if (r.lan) srcLan = r.lan
                }).catch(err => {
                    debug(err)
                })
            }
            if (srcLan === tarLan) tarLan = srcLan === 'zh' ? 'en' : 'zh'
            return this.trans(q, srcLan, tarLan)
        },
        tts(q, lan) {
            return new Promise((resolve, reject) => {
                if (!inArray(lan, this.lanTTS)) reject('This language is not supported!')
                if (lan === 'yue') lan = 'cte' // 粤语
                // https://tts.baidu.com/text2audio?tex=%E6%98%8E(ming2)%E7%99%BD(bai2)&cuid=baike&lan=ZH&ctp=1&pdt=31&vol=9&spd=4&per=4100
                let getUrl = (s) => {
                    return `https://fanyi.baidu.com/gettts?lan=${lan}&text=${encodeURIComponent(s)}&spd=3&source=web`
                }
                let r = []
                let arr = sliceStr(q, 128)
                arr.forEach(text => {
                    r.push(getUrl(text))
                })
                resolve(r)
            })
        },
        link(q, srcLan, tarLan) {
            return `https://fanyi.baidu.com/#${srcLan}/${tarLan}/${encodeURIComponent(q)}`
        },
    }
}
