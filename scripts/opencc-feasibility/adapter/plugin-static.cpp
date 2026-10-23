// Browser binding adapter; the actual segmenter is official JiebaSegmentation.
#include "PluginSegmentation.hpp"
#include "JiebaSegmentation.hpp"
#include "Exception.hpp"
#include <fstream>
#include <string>

namespace opencc {
SegmentationPtr CreatePluginSegmentation(const std::string& type,
                                         const PluginConfigPairs& pairs) {
  if (type != "jieba") throw InvalidFormat("Unsupported browser segmenter: " + type);
  const auto get = [&](const std::string& key) {
    for (const auto& pair : pairs) if (pair.first == key) return pair.second;
    return std::string();
  };
  const auto resolve = [&](const std::string& value) {
    if (value.empty() || value.front() == '/') return value;
    const auto dir = get("__config_dir");
    const auto direct = dir + "/" + value;
    if (std::ifstream(direct).good()) return direct;
    return dir.substr(0, dir.find_last_of('/')) + "/" + value;
  };
  const auto dict = resolve(get("dict_path")), model = resolve(get("model_path"));
  if (dict.empty() || model.empty()) throw InvalidFormat("Missing Jieba resources");
  const auto dir = dict.substr(0, dict.find_last_of('/'));
  for (const auto& file : {dict, model, dir + "/idf.utf8", dir + "/stop_words.utf8"})
    if (!std::ifstream(file).good()) throw InvalidFormat("Missing Jieba file: " + file);
  return SegmentationPtr(new JiebaSegmentation(dict, model,
      resolve(get("user_dict_path")), dir + "/idf.utf8", dir + "/stop_words.utf8"));
}
}
