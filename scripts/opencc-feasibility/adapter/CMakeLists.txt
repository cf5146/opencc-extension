cmake_minimum_required(VERSION 3.20)
project(opencc_browser_feasibility LANGUAGES C CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
if(NOT OPENCC_SOURCE_DIR)
  message(FATAL_ERROR "OPENCC_SOURCE_DIR must identify the verified official release")
endif()
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
set(OPENCC_ENABLE_INSTALL OFF CACHE BOOL "" FORCE)
set(BUILD_OPENCC_JIEBA_PLUGIN OFF CACHE BOOL "" FORCE)
set(ENABLE_GTEST OFF CACHE BOOL "" FORCE)
set(ENABLE_BENCHMARK OFF CACHE BOOL "" FORCE)
set(BUILD_PYTHON OFF CACHE BOOL "" FORCE)
add_subdirectory("${OPENCC_SOURCE_DIR}" opencc EXCLUDE_FROM_ALL)
# WASM has no native shared-library plugin loader. Only replace discovery;
# segmentation and conversion still compile from the unchanged official tree.
get_target_property(core_sources libopencc SOURCES)
list(FILTER core_sources EXCLUDE REGEX "(^|/)PluginSegmentation[.]cpp$")
set_property(TARGET libopencc PROPERTY SOURCES "${core_sources}")
target_sources(libopencc PRIVATE
  "${CMAKE_CURRENT_SOURCE_DIR}/plugin-static.cpp"
  "${OPENCC_SOURCE_DIR}/plugins/jieba/src/JiebaSegmentation.cpp")
target_include_directories(libopencc PRIVATE
  "${OPENCC_SOURCE_DIR}/plugins/jieba/include"
  "${OPENCC_SOURCE_DIR}/plugins/jieba/deps/cppjieba/include")
add_executable(opencc_browser binding.cpp)
target_link_libraries(opencc_browser PRIVATE libopencc)
target_compile_options(opencc_browser PRIVATE -fexceptions)
set_target_properties(opencc_browser PROPERTIES OUTPUT_NAME opencc SUFFIX .mjs)
target_link_options(opencc_browser PRIVATE
  --no-entry -fexceptions -O2
  "-sMODULARIZE=1" "-sEXPORT_ES6=1" "-sENVIRONMENT=web,worker,node"
  "-sALLOW_MEMORY_GROWTH=1" "-sINITIAL_MEMORY=67108864" "-sMAXIMUM_MEMORY=2147483648"
  "-sSTACK_SIZE=1048576" "-sFILESYSTEM=1" "-sDISABLE_EXCEPTION_CATCHING=0"
  "-sEXPORTED_FUNCTIONS=['_malloc','_free','_oc_create','_oc_convert','_oc_output_size','_oc_destroy','_oc_error']"
  "-sEXPORTED_RUNTIME_METHODS=['FS','HEAPU8','UTF8ToString','stringToUTF8','lengthBytesUTF8']")
