import { LucideMove } from "lucide-react";
import {
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import styles from "./CameraPreviewOverlay.module.css";

export function CameraPreviewOverlay() {
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const [activeDeviceId, setActiveDeviceId] = useState<string | undefined>(() => {
		const params = new URLSearchParams(window.location.search);
		return params.get("deviceId") || undefined;
	});
	const [isDragging, setIsDragging] = useState(false);
	const [hasStream, setHasStream] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Listen for camera device changes from main process
	useEffect(() => {
		const unsubscribe = window.electronAPI?.onCameraPreviewDeviceChanged?.((deviceId) => {
			setActiveDeviceId(deviceId || undefined);
		});
		return () => {
			unsubscribe?.();
		};
	}, []);

	// Acquire and display live camera stream
	useEffect(() => {
		let cancelled = false;
		let currentStream: MediaStream | null = null;
		setHasStream(false);
		setError(null);

		const startCamera = async () => {
			try {
				const constraints: MediaStreamConstraints = {
					audio: false,
					video: activeDeviceId
						? {
								deviceId: { exact: activeDeviceId },
								width: { ideal: 1280 },
								height: { ideal: 720 },
							}
						: { width: { ideal: 1280 }, height: { ideal: 720 } },
				};

				const stream = await navigator.mediaDevices.getUserMedia(constraints);
				if (cancelled) {
					stream.getTracks().forEach((track) => track.stop());
					return;
				}

				currentStream = stream;
				if (videoRef.current) {
					videoRef.current.srcObject = stream;
					videoRef.current.play().catch(() => {
						// Autoplay might be interrupted
					});
				}
				setHasStream(true);
			} catch (err) {
				if (!cancelled) {
					console.error("Camera preview error:", err);
					setError(err instanceof Error ? err.message : "Failed to access camera");
				}
			}
		};

		void startCamera();

		return () => {
			cancelled = true;
			if (currentStream) {
				currentStream.getTracks().forEach((track) => track.stop());
			}
			if (videoRef.current) {
				videoRef.current.srcObject = null;
			}
		};
	}, [activeDeviceId]);

	// Draggability across the screen
	const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
		if (event.button !== 0) return; // Only primary mouse button
		const target = event.currentTarget;
		event.preventDefault();
		event.stopPropagation();

		setIsDragging(true);
		target.setPointerCapture(event.pointerId);
		window.electronAPI?.beginCameraPreviewDrag?.();

		const startClientX = event.clientX;
		const startClientY = event.clientY;

		const handlePointerMove = (e: PointerEvent) => {
			const deltaX = e.clientX - startClientX;
			const deltaY = e.clientY - startClientY;
			window.electronAPI?.dragCameraPreviewTo?.(deltaX, deltaY);
		};

		const handlePointerUp = () => {
			setIsDragging(false);
			target.removeEventListener("pointermove", handlePointerMove);
			target.removeEventListener("pointerup", handlePointerUp);
			target.removeEventListener("pointercancel", handlePointerUp);
			try {
				target.releasePointerCapture(event.pointerId);
			} catch {
				// pointer already released
			}
			window.electronAPI?.endCameraPreviewDrag?.();
		};

		target.addEventListener("pointermove", handlePointerMove);
		target.addEventListener("pointerup", handlePointerUp);
		target.addEventListener("pointercancel", handlePointerUp);
	}, []);

	return (
		<div className={styles.container}>
			<div
				className={`${styles.previewCard} ${isDragging ? styles.dragging : ""}`}
				onPointerDown={handlePointerDown}
				title="Drag to position camera"
			>
				<video
					ref={videoRef}
					className={styles.video}
					autoPlay
					playsInline
					muted
					style={{ display: hasStream ? "block" : "none" }}
				/>

				{!hasStream && (
					<div className={styles.placeholder}>
						{error ? (
							<span>{error}</span>
						) : (
							<>
								<div className={styles.spinner} />
								<span>Starting camera...</span>
							</>
						)}
					</div>
				)}

				<div className={styles.dragHandleBadge}>
					<LucideMove size={11} />
					<span>Drag</span>
				</div>
			</div>
		</div>
	);
}
