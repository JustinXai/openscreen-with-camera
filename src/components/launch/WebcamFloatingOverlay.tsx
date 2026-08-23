import { useCallback, useEffect, useRef, useState } from "react";

const TARGET_FRAME_RATE = 30;

export function WebcamFloatingOverlay() {
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const dragOriginRef = useRef<{ x: number; y: number } | null>(null);
	const resizePointerIdRef = useRef<number | null>(null);
	const [hasVideo, setHasVideo] = useState(false);

	useEffect(() => {
		let cancelled = false;
		const cameraDeviceId =
			new URLSearchParams(window.location.search).get("cameraDeviceId") || undefined;

		const acquire = async () => {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					audio: false,
					video: cameraDeviceId
						? {
								deviceId: { exact: cameraDeviceId },
								frameRate: { ideal: TARGET_FRAME_RATE, max: TARGET_FRAME_RATE },
							}
						: {
								frameRate: { ideal: TARGET_FRAME_RATE, max: TARGET_FRAME_RATE },
							},
				});
				if (cancelled) {
					stream.getTracks().forEach((track) => track.stop());
					return;
				}
				streamRef.current = stream;
				if (videoRef.current) {
					videoRef.current.srcObject = stream;
				}
			} catch (error) {
				console.warn("Failed to open webcam overlay stream:", error);
			}
		};

		void acquire();

		return () => {
			cancelled = true;
			streamRef.current?.getTracks().forEach((track) => track.stop());
			streamRef.current = null;
		};
	}, []);

	const handleDragPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
		if ((event.target as HTMLElement | null)?.closest("[data-webcam-resize='true']")) return;
		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		dragOriginRef.current = { x: event.screenX, y: event.screenY };
		window.electronAPI?.beginWebcamOverlayDrag?.();
	}, []);

	const handleDragPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
		const origin = dragOriginRef.current;
		if (!origin) return;
		window.electronAPI?.dragWebcamOverlayTo?.(event.screenX - origin.x, event.screenY - origin.y);
	}, []);

	const handleDragPointerEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
		if (!dragOriginRef.current) return;
		dragOriginRef.current = null;
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
		window.electronAPI?.endWebcamOverlayDrag?.();
	}, []);

	const handleResizePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
		event.preventDefault();
		event.stopPropagation();
		resizePointerIdRef.current = event.pointerId;
		event.currentTarget.setPointerCapture(event.pointerId);
		window.electronAPI?.beginWebcamOverlayResize?.(event.screenX, event.screenY);
	}, []);

	const handleResizePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
		if (resizePointerIdRef.current !== event.pointerId) return;
		window.electronAPI?.resizeWebcamOverlayTo?.(event.screenX, event.screenY);
	}, []);

	const handleResizePointerEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
		if (resizePointerIdRef.current !== event.pointerId) return;
		resizePointerIdRef.current = null;
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
		window.electronAPI?.endWebcamOverlayResize?.();
	}, []);

	return (
		<div
			className="h-screen w-screen select-none bg-transparent p-[5px]"
			onPointerDown={handleDragPointerDown}
			onPointerMove={handleDragPointerMove}
			onPointerUp={handleDragPointerEnd}
			onPointerCancel={handleDragPointerEnd}
		>
			<div
				className="relative h-full w-full overflow-hidden rounded-full border-[3px] border-[#ff4d57] bg-black shadow-[0_12px_34px_rgba(0,0,0,0.36)]"
				style={{ cursor: "grab" }}
			>
				<video
					ref={videoRef}
					className={`h-full w-full object-cover transition-opacity duration-150 ${
						hasVideo ? "opacity-100" : "opacity-0"
					}`}
					autoPlay
					muted
					playsInline
					onLoadedData={() => setHasVideo(true)}
				/>
				<div
					data-webcam-resize="true"
					className="absolute bottom-0 right-0 h-16 w-16"
					style={{ cursor: "nwse-resize" }}
					onPointerDown={handleResizePointerDown}
					onPointerMove={handleResizePointerMove}
					onPointerUp={handleResizePointerEnd}
					onPointerCancel={handleResizePointerEnd}
				>
					<div className="absolute bottom-3 right-3 h-6 w-6 rounded-full border border-white/85 bg-black/45 shadow-[0_2px_10px_rgba(0,0,0,0.35)]" />
				</div>
			</div>
		</div>
	);
}
