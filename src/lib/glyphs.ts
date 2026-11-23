/**
 * Outlines of the eleven hero letters, taken from Anybody (SIL OFL) at weight
 * 900: VELVET at width 60, LAYNE at width 75. Each letter is normalised to its own
 * box (0,0 is its top-left). Having real outlines lets the name stretch to fill
 * any screen and lets each letter clip a canvas scene exactly.
 * Regenerate with the script described in CLAUDE.md.
 */
export type Glyph = { ch: string; w: number; h: number; d: string };

export const VELVET: Glyph[] = [
 {
  "ch": "V",
  "w": 881,
  "h": 1350,
  "d": "M159 1350L723 1350L881 0L506 0L444 1086L440 1086L377 0L0 0Z"
 },
 {
  "ch": "E",
  "w": 599,
  "h": 1350,
  "d": "M0 1350L599 1350L599 1085L370 1085L370 799L587 799L587 540L370 540L370 265L599 265L599 0L0 0Z"
 },
 {
  "ch": "L",
  "w": 579,
  "h": 1350,
  "d": "M0 1350L579 1350L579 1089L369 1089L369 0L0 0Z"
 },
 {
  "ch": "V",
  "w": 881,
  "h": 1350,
  "d": "M159 1350L723 1350L881 0L506 0L444 1086L440 1086L377 0L0 0Z"
 },
 {
  "ch": "E",
  "w": 599,
  "h": 1350,
  "d": "M0 1350L599 1350L599 1085L370 1085L370 799L587 799L587 540L370 540L370 265L599 265L599 0L0 0Z"
 },
 {
  "ch": "T",
  "w": 725,
  "h": 1350,
  "d": "M178 1350L548 1350L548 265L725 265L725 0L0 0L0 265L178 265Z"
 }
];

export const LAYNE: Glyph[] = [
 {
  "ch": "L",
  "w": 725,
  "h": 1352,
  "d": "M0 1352L725 1352L725 1074L402 1074L402 2L0 2Z"
 },
 {
  "ch": "A",
  "w": 1104,
  "h": 1352,
  "d": "M0 1352L411 1352L448 1051L657 1051L694 1352L1104 1352L848 0L253 0ZM484 774L550 259L555 259L621 774Z"
 },
 {
  "ch": "Y",
  "w": 1165,
  "h": 1352,
  "d": "M382 1352L784 1352L784 906L1165 2L742 2L585 534L582 534L423 2L0 2L382 905Z"
 },
 {
  "ch": "N",
  "w": 1246,
  "h": 1352,
  "d": "M0 1352L398 1352L398 289L404 289L616 1352L1246 1352L1246 2L847 2L841 1047L837 1047L629 2L0 2Z"
 },
 {
  "ch": "E",
  "w": 774,
  "h": 1352,
  "d": "M0 1352L774 1352L774 1071L403 1071L403 808L748 808L748 536L403 536L403 283L774 283L774 2L0 2Z"
 }
];
