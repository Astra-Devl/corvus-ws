'use strict'
/**
 * Pintu masuk gaya WAProto:
 *   const { proto } = require('corvus-ws/WAProto')
 *   proto.Message.encode({ conversation: 'halo' })
 * Isinya sama dengan modul `proto/` di library (butuh `npm run build`).
 */
module.exports = require('../dist/cjs/proto/index.js')
