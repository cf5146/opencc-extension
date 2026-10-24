# OpenCC 產品術語 / OpenCC Product Glossary

統一目前官方引擎產品路徑的用語。
Terms used by the current official-engine product.

## 用語 / Language

**預設組態 / Preset**：
指定中文轉換方向與用詞規則的官方命名設定，例如 s2twp。
An officially named configuration specifying conversion direction and vocabulary rules, such as s2twp.
_避免 / Avoid_：任意來源／目標配對 / Arbitrary source/target pair.

**分詞方式 / Segmentation mode**：
轉換使用的文字切分方式，可選 Jieba 或 mmseg。
The text segmentation method used for conversion: Jieba or mmseg.

**轉換組態 / Conversion configuration**：
預設組態與分詞方式的組合。
The combination of a preset and segmentation mode.

**網站規則 / Site rule**：
為完全相同的主機名稱啟用自動轉換並保存其轉換組態的設定。
An opt-in automatic-conversion setting and saved configuration for an exact hostname.
_避免 / Avoid_：網域萬用規則、全域自動轉換 / Wildcard domain rule, global automatic conversion.

**自動轉換 / Automatic conversion**：
在已啟用的網站，依其組態轉換網頁及後續變動文字的模式。
A mode that converts page text and subsequent changes on enabled sites using their saved configurations.

**手動轉換 / Manual conversion**：
由使用者明確要求的目前網頁或選取範圍轉換。
Conversion of the current page or selection explicitly requested by the user.

**舊設定 / Legacy settings**：
前一代產品儲存、目前保留但不套用的設定。
Stored settings from the previous product generation, retained but not applied by the current product.
