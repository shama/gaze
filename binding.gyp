{
  "targets": [
    {
      "target_name": "pathwatcher",
      "sources": [
        "src/main.cc",
        "src/common.cc",
        "src/common.h",
        "src/handle_map.cc",
        "src/handle_map.h",
        "src/unsafe_persistent.h",
      ],
      "include_dirs": [
        "src",
        '<!(node -e "require(\'nan\')")'
      ],
      "conditions": [
        ['OS=="win"', {
          "sources": [
            "src/pathwatcher_win.cc",
          ],
          'msvs_settings': {
            'VCCLCompilerTool': {
              'ExceptionHandling': 1, # /EHsc
              'WarnAsError': 'true',
            },
          },
          'msvs_disabled_warnings': [
            4018,  # signed/unsigned mismatch
            4267, 4244,  # conversion from 'size_t' to 'int', possible loss of data
            4530,  # C++ exception handler used, but unwind semantics are not enabled
            4506,  # no definition for inline function
            4996,  # function was declared deprecated
          ],
          'defines': [
            '_WIN32_WINNT=0x0600',
          ],
        }],  # OS=="win"
        ['OS=="mac"', {
          "sources": [
            "src/pathwatcher_mac.mm",
          ],
        }],  # OS=="mac"
        ['OS=="linux"', {
          "sources": [
            "src/pathwatcher_linux.cc",
          ],
        }],  # OS=="linux"
      ],
    }
  ]
}
