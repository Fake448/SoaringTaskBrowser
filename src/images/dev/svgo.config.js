module.exports = {
  multipass: true,
  floatPrecision: 3,
  plugins: [
    'removeMetadata',
    'removeEditorsData',
    'cleanupAttrs',
    'removeUselessDefs',
    'removeComments',
    'removeXMLNS'
  ]
}
