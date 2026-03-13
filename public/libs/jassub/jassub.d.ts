import 'rvfc-polyfill';
import { Debug } from './debug.ts';
import type { WeightValue } from './worker/util.ts';
import type { ASSRenderer } from './worker/worker';
import type { Remote } from 'abslink';
export type JASSUBOptions = {
    timeOffset?: number;
    debug?: boolean;
    prescaleFactor?: number;
    prescaleHeightLimit?: number;
    maxRenderHeight?: number;
    workerUrl?: string;
    wasmUrl?: string;
    modernWasmUrl?: string;
    fonts?: Array<string | Uint8Array>;
    availableFonts?: Record<string, Uint8Array | string>;
    defaultFont?: string;
    queryFonts?: 'local' | 'localandremote' | false;
    libassMemoryLimit?: number;
    libassGlyphLimit?: number;
} & ({
    video: HTMLVideoElement;
    canvas?: HTMLCanvasElement;
} | {
    video?: HTMLVideoElement;
    canvas: HTMLCanvasElement;
}) & ({
    subUrl: string;
    subContent?: string;
} | {
    subUrl?: string;
    subContent: string;
});
export default class JASSUB {
    timeOffset: number;
    prescaleFactor: number;
    prescaleHeightLimit: number;
    maxRenderHeight: number;
    debug: Debug | null;
    renderer: Remote<ASSRenderer>;
    ready: Promise<void>;
    busy: boolean;
    _video: HTMLVideoElement | undefined;
    _videoWidth: number;
    _videoHeight: number;
    _videoColorSpace: string | null;
    _canvas: HTMLCanvasElement;
    _canvasParent: HTMLDivElement | undefined;
    _ctrl: AbortController;
    _ro: ResizeObserver;
    _destroyed: boolean;
    _lastDemandTime: VideoFrameCallbackMetadata;
    _skipped: boolean;
    _worker: Worker;
    constructor(opts: JASSUBOptions);
    static _supportsSIMD?: boolean;
    static _test(): void;
    resize(forceRepaint?: boolean, width?: number, height?: number, top?: number, left?: number): Promise<void>;
    _getVideoPosition(width?: number, height?: number): {
        width: number;
        height: number;
        x: number;
        y: number;
    };
    _computeCanvasSize(width?: number, height?: number): {
        width: number;
        height: number;
    };
    setVideo(video: HTMLVideoElement): Promise<void>;
    _getLocalFont(font: string, weight?: WeightValue): Promise<Uint8Array<ArrayBuffer> | undefined>;
    _handleRVFC(data: VideoFrameCallbackMetadata): void;
    _demandRender(repaint?: boolean): Promise<void>;
    _updateColorSpace(): Promise<void>;
    _removeListeners(): void;
    destroy(): Promise<void>;
}
