{
    "targets": [
    {
      "target_name": "addon",
      # "sources": [ "binding.cpp" ],
      "sources": [ "cpp/xarray.cc" ],
      'include_dirs': ["<!@(node -p \"require('node-addon-api').include\")","cpp","cpp/xtensor","cpp/xtl"],
      'dependencies': ["<!(node -p \"require('node-addon-api').gyp\")"],
      'cflags!': [ '-fno-exceptions' ],
      'cflags_cc!': [ '-fno-exceptions' ],
      'msvs_settings': {
        'VCCLCompilerTool': { 'ExceptionHandling': 1 },
      }
    }
  ]
}
#   "targets": [
#     {
#       "target_name": "native",
#       "sources": [
#         "binding.cpp"
#       ],
#       "include_dirs": [
#         "<!@(node -p \"require('node-addon-api').include\")"
#       ],
#       "dependencies": [
#         "<!(node -p \"require('node-addon-api').gyp\")"
#       ],
#       "cflags!": ["-fno-exceptions"],
#       "cflags_cc!": ["-fno-exceptions"],
#       "defines": ["NAPI_CPP_EXCEPTIONS"]
#     }
#   ]