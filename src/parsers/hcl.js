// Парсер HCL/Terraform (.tf, .hcl)
// Поддерживает: resource, data, module, variable, output, locals, provider, terraform

import { esc } from "./utils.js"

export default {
  extensions: [".tf", ".hcl"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*(?:#|\/\/|\/\*)/.test(line)) continue

      // resource "type" "name" { или data "type" "name" {
      const twoM = line.match(/^\s*(resource|data)\s+"([^"]+)"\s+"([^"]+)"\s*\{/)
      if (twoM) {
        results.push({ name: `${twoM[1]}.${twoM[2]}.${twoM[3]}`, line: i + 1 })
        continue
      }

      // module "name" { / variable "name" { / output "name" { / provider "name" {
      const oneM = line.match(/^\s*(module|variable|output|provider)\s+"([^"]+)"\s*\{/)
      if (oneM) {
        results.push({ name: `${oneM[1]}.${oneM[2]}`, line: i + 1 })
        continue
      }

      // terraform { / locals {
      const bareM = line.match(/^\s*(terraform|locals)\s*\{/)
      if (bareM) {
        results.push({ name: bareM[1], line: i + 1 })
      }
    }
    return results
  },

  findMethodStart(lines, methodName) {
    // methodName может быть: "resource.aws_s3_bucket.my_bucket", "variable.name", "locals"
    const parts = methodName.split('.')
    let p
    if (parts.length === 3 && (parts[0] === 'resource' || parts[0] === 'data')) {
      const [kw, type, name] = parts.map(esc)
      p = new RegExp(`${kw}\\s+"${type}"\\s+"${name}"\\s*\\{`)
    } else if (parts.length === 2) {
      const [kw, name] = parts.map(esc)
      p = new RegExp(`${kw}\\s+"${name}"\\s*\\{`)
    } else {
      p = new RegExp(`^\\s*${esc(methodName)}\\s*\\{`)
    }
    for (let i = 0; i < lines.length; i++) {
      if (p.test(lines[i])) return i + 1
    }
    return null
  }
}
