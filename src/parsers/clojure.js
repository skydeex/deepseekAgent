// Парсер Clojure (.clj, .cljs, .cljc)
// Поддерживает: defn, defn-, defmacro, defmethod, defprotocol, deftype,
//               defrecord, defmulti, definterface

import { esc } from "./utils.js"

const DEF_RE = /^\s*\((defn-?|defmacro|defmethod|defprotocol|deftype|defrecord|defmulti|definterface)\s+([\w!?<>.*+\-/':]+)/

export default {
  extensions: [".clj", ".cljs", ".cljc"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*;/.test(lines[i])) continue
      const m = lines[i].match(DEF_RE)
      if (m) results.push({ name: m[2] + "()", line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const e = esc(methodName)
    const p = new RegExp(`\\((?:defn-?|defmacro|defmethod|defprotocol|deftype|defrecord|defmulti|definterface)\\s+${e}\\b`)
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*;/.test(lines[i])) continue
      if (p.test(lines[i]) && lines[i].includes(methodName)) return i + 1
    }
    return null
  }
}
