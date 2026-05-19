// Парсер Common Lisp (.lisp, .cl, .lsp)
// Поддерживает: defun, defmethod, defgeneric, defmacro, defclass,
//               defstruct, defparameter, defvar, defconstant

import { esc } from "./utils.js"

const CL_DEFS = "defun|defmethod|defgeneric|defmacro|defclass|defstruct|deftype|defpackage|defparameter|defvar|defconstant"

export default {
  extensions: [".lisp", ".cl", ".lsp"],

  outline(lines) {
    const results = []
    const pattern = new RegExp(`^\\s*\\((${CL_DEFS})\\s+([a-zA-Z*+<>!?=_/-][a-zA-Z0-9*+<>!?=_/-]*)`)
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*;/.test(lines[i])) continue
      const m = lines[i].match(pattern)
      if (m) results.push({ name: m[2] + "()", line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const name = methodName.replace(/\(\)$/, '')
    const e = esc(name)
    const p = new RegExp(`\\((?:${CL_DEFS})\\s+${e}\\b`)
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*;/.test(lines[i])) continue
      if (p.test(lines[i]) && lines[i].includes(name)) return i + 1
    }
    return null
  }
}
