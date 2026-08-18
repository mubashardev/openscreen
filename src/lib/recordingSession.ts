export interface ProjectMedia {
	screenVideoPath: string;
	webcamVideoPath?: string;
	/**
	 * Milliseconds to shift the webcam asset's playback position relative to
	 * the screen recording. Negative when the webcam started capturing before
	 * the screen recording's real start (e.g. the browser MediaRecorder for
	 * the webcam is started in the renderer before the native Windows helper
	 * process finishes spawning and confirms recording), so the editor skips
	 * that much extra leading footage instead of showing stale camera frames.
	 */
	webcamOffsetMs?: number;
	cursorCaptureMode?: CursorCaptureMode;
	webcamPosition?: { cx: number; cy: number } | null;
}

export type CursorCaptureMode = "editable-overlay" | "system";

export interface RecordingSession extends ProjectMedia {
	createdAt: number;
}

export interface RecordedVideoAssetInput {
	fileName: string;
	videoData: ArrayBuffer;
}

export interface StoreRecordedSessionInput {
	screen: RecordedVideoAssetInput;
	webcam?: RecordedVideoAssetInput;
	createdAt?: number;
	cursorCaptureMode?: CursorCaptureMode;
	/**
	 * Recording wall-clock duration (ms). The main process patches the WebM Duration
	 * header on streamed recordings (the renderer no longer holds the bytes). Browser
	 * MediaRecorder writes no/zero duration, which breaks the editor seek bar and
	 * timeline for anything that took the streaming path.
	 */
	durationMs?: number;
	/** See {@link ProjectMedia.webcamOffsetMs}. */
	webcamOffsetMs?: number;
	webcamPosition?: { cx: number; cy: number } | null;
}

export function normalizeCursorCaptureMode(value: unknown): CursorCaptureMode | undefined {
	return value === "editable-overlay" || value === "system" ? value : undefined;
}

function normalizeWebcamPosition(
	candidate: unknown,
): { cx: number; cy: number } | null | undefined {
	if (candidate === null) return null;
	if (!candidate || typeof candidate !== "object") return undefined;
	const raw = candidate as { cx?: unknown; cy?: unknown };
	if (
		typeof raw.cx === "number" &&
		Number.isFinite(raw.cx) &&
		typeof raw.cy === "number" &&
		Number.isFinite(raw.cy)
	) {
		return {
			cx: Math.max(0, Math.min(1, raw.cx)),
			cy: Math.max(0, Math.min(1, raw.cy)),
		};
	}
	return undefined;
}

function normalizePath(value: unknown): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed ? trimmed : undefined;
}

export function normalizeProjectMedia(candidate: unknown): ProjectMedia | null {
	if (!candidate || typeof candidate !== "object") {
		return null;
	}

	const raw = candidate as Partial<ProjectMedia>;
	const screenVideoPath = normalizePath(raw.screenVideoPath);

	if (!screenVideoPath) {
		return null;
	}

	const webcamVideoPath = normalizePath(raw.webcamVideoPath);
	const cursorCaptureMode = normalizeCursorCaptureMode(raw.cursorCaptureMode);
	const webcamPosition = normalizeWebcamPosition(raw.webcamPosition);
	const webcamOffsetMs =
		typeof raw.webcamOffsetMs === "number" && Number.isFinite(raw.webcamOffsetMs)
			? raw.webcamOffsetMs
			: undefined;

	return {
		screenVideoPath,
		...(webcamVideoPath ? { webcamVideoPath } : {}),
		...(webcamOffsetMs !== undefined ? { webcamOffsetMs } : {}),
		...(cursorCaptureMode ? { cursorCaptureMode } : {}),
		...(webcamPosition !== undefined ? { webcamPosition } : {}),
	};
}

export function normalizeRecordingSession(candidate: unknown): RecordingSession | null {
	if (!candidate || typeof candidate !== "object") {
		return null;
	}

	const raw = candidate as Partial<RecordingSession>;
	const media = normalizeProjectMedia(raw);
	if (!media) {
		return null;
	}

	return {
		...media,
		createdAt:
			typeof raw.createdAt === "number" && Number.isFinite(raw.createdAt)
				? raw.createdAt
				: Date.now(),
	};
}
