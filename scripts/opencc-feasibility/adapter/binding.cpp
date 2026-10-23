#include "SimpleConverter.hpp"
#include <cstdint>
#include <memory>
#include <string>
#include <unordered_map>
#include <vector>

namespace {
struct Handle {
  explicit Handle(const std::string& config)
      : converter(config, std::vector<std::string>{"/data/dict", "/data"}) {}
  opencc::SimpleConverter converter;
  std::string output;
};
std::unordered_map<uint32_t, std::unique_ptr<Handle>> handles;
uint32_t nextId = 1;
std::string lastError;
}
extern "C" {
uint32_t oc_create(const char* config) {
  try {
    auto handle = std::make_unique<Handle>(config);
    const auto id = nextId++;
    handles.emplace(id, std::move(handle)); lastError.clear(); return id;
  } catch (const std::exception& e) { lastError = e.what(); return 0; }
}
const char* oc_convert(uint32_t id, const char* text, size_t length) {
  const auto it = handles.find(id);
  if (it == handles.end()) { lastError = "Invalid converter handle"; return nullptr; }
  try {
    it->second->output = it->second->converter.Convert(text, length);
    lastError.clear(); return it->second->output.data();
  } catch (const std::exception& e) { lastError = e.what(); return nullptr; }
}
size_t oc_output_size(uint32_t id) {
  const auto it = handles.find(id); return it == handles.end() ? 0 : it->second->output.size();
}
void oc_destroy(uint32_t id) { handles.erase(id); }
const char* oc_error() { return lastError.c_str(); }
}
