import type { ComponentType } from "react";
import type { Tool } from "../lib/types";
import { CompressorPanel, TargetSizePanel, ResizeCompressPanel, BatchCompressorPanel } from "./compress";
import { ConvertPanel, SvgRasterPanel, HeicPanel, Base64Panel, Base64DecodePanel, PdfPanel, ZipPanel, BlobUrlPanel } from "./convert";
import {
  ResizePanel, AspectResizePanel, CropPanel, FixedCropPanel, ProfilePicPanel, RotatePanel, FlipPanel,
  RoundedPanel, BorderPanel, ShadowPanel,
} from "./transform";
import {
  FilterSliderPanel, BwPanel, SharpenPanel, EnhancePanel, TemperaturePanel, VignettePanel,
  VintagePanel, OverlayPanel, DuotonePanel,
} from "./effects";
import { WmTextPanel, WmImagePanel, TextOnImagePanel, MemePanel, BadgePanel } from "./text";
import {
  ColorPickerPanel, DominantPanel, PalettePanel, InfoPanel, ExifViewPanel, ExifRemovePanel,
  AspectCalcPanel, PrintCalcPanel,
} from "./color";
import {
  FaviconPanel, PlaceholderPanel, SolidPanel, GradientPanel, QrPanel, OgPanel, BeforeAfterPanel,
} from "./generators";
import {
  BatchResizePanel, BatchConvertPanel, BatchRenamePanel, BatchRoundedPanel, BatchWatermarkPanel,
} from "./batch";
import { NotebookPanel } from "./notebook";

export type PanelProps = { tool: Tool };

export const PANELS: Record<string, ComponentType<PanelProps>> = {
  compressor: CompressorPanel,
  batchCompressor: BatchCompressorPanel,
  targetSize: TargetSizePanel,
  resizeCompress: ResizeCompressPanel,
  converter: ConvertPanel,
  svgRaster: SvgRasterPanel,
  heic: HeicPanel,
  base64: Base64Panel,
  base64Decode: Base64DecodePanel,
  pdf: PdfPanel,
  zip: ZipPanel,
  blobUrl: BlobUrlPanel,
  resizer: ResizePanel,
  percentResizer: ResizePanel,
  aspectResizer: AspectResizePanel,
  crop: CropPanel,
  fixedCrop: FixedCropPanel,
  profilePic: ProfilePicPanel,
  rotate: RotatePanel,
  flip: FlipPanel,
  rounded: RoundedPanel,
  border: BorderPanel,
  shadow: ShadowPanel,
  filterSlider: FilterSliderPanel,
  bw: BwPanel,
  sharpen: SharpenPanel,
  enhance: EnhancePanel,
  temperature: TemperaturePanel,
  vignette: VignettePanel,
  vintage: VintagePanel,
  overlay: OverlayPanel,
  duotone: DuotonePanel,
  wmText: WmTextPanel,
  wmImage: WmImagePanel,
  textOnImage: TextOnImagePanel,
  meme: MemePanel,
  badge: BadgePanel,
  colorPicker: ColorPickerPanel,
  dominant: DominantPanel,
  palette: PalettePanel,
  info: InfoPanel,
  exifView: ExifViewPanel,
  exifRemove: ExifRemovePanel,
  aspectCalc: AspectCalcPanel,
  printCalc: PrintCalcPanel,
  favicon: FaviconPanel,
  placeholder: PlaceholderPanel,
  solid: SolidPanel,
  gradient: GradientPanel,
  qr: QrPanel,
  og: OgPanel,
  beforeAfter: BeforeAfterPanel,
  batchResize: BatchResizePanel,
  batchConvert: BatchConvertPanel,
  batchRename: BatchRenamePanel,
  batchRounded: BatchRoundedPanel,
  batchWatermark: BatchWatermarkPanel,
  notebook: NotebookPanel,
};
