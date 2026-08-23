import { useCallback, useEffect, useRef, useState } from "react";

const TARGET_FRAME_RATE = 30;

export function WebcamFloatingOverlay() {
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const softVideoRef = useRef<HTMLVideoElement | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const dragOriginRef = useRef<{ x: number; y: number } | null>(null);
	const resizePointerIdRef = useRef<number | null>(null);
	const [hasVideo, setHasVideo] = useState(false);
	const [showControls, setShowControls] = useState(() => {
		return new URLSearchParams(window.location.search).get("controls") !== "0";
	});

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
				if (softVideoRef.current) {
					softVideoRef.current.srcObject = stream;
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

	useEffect(() => {
		return window.electronAPI?.onWebcamOverlayControlsVisible?.((visible) => {
			setShowControls(visible);
		});
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
			className="relative h-screen w-screen select-none bg-transparent p-[8px]"
			onPointerDown={handleDragPointerDown}
			onPointerMove={handleDragPointerMove}
			onPointerUp={handleDragPointerEnd}
			onPointerCancel={handleDragPointerEnd}
		>
			<div
				className="relative h-full w-full overflow-hidden rounded-full border-[3px] border-[#0b0b0f] bg-black shadow-[0_12px_34px_rgba(0,0,0,0.36)]"
				style={{ cursor: "grab" }}
			>
				<video
					ref={videoRef}
					className={`h-full w-full object-cover transition-opacity duration-150 ${
						hasVideo ? "opacity-100" : "opacity-0"
					}`}
					style={{
						filter: "brightness(1.06) contrast(0.96) saturate(1.08) blur(0.18px)",
						transform: "scaleX(0.955) scaleY(1.035)",
					}}
					autoPlay
					muted
					playsInline
					onLoadedData={() => setHasVideo(true)}
				/>
				<video
					ref={softVideoRef}
					className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-150 ${
						hasVideo ? "opacity-20" : "opacity-0"
					}`}
					style={{
						filter: "blur(2.2px) brightness(1.08) saturate(1.04)",
						transform: "scaleX(0.955) scaleY(1.035)",
					}}
					autoPlay
					muted
					playsInline
				/>
				<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.10),transparent_58%)]" />
			</div>
			{showControls ? (
				<div
					data-webcam-resize="true"
					className="absolute bottom-0 right-0 z-10 flex h-16 w-16 items-end justify-end p-1"
					style={{ cursor: "nwse-resize" }}
					title="拖动调整摄像头大小"
					onPointerDown={handleResizePointerDown}
					onPointerMove={handleResizePointerMove}
					onPointerUp={handleResizePointerEnd}
					onPointerCancel={handleResizePointerEnd}
				>
					<div className="relative h-8 w-8 rounded-full border-2 border-[#0b0b0f] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.42)]">
						<div className="absolute bottom-[8px] right-[7px] h-[2px] w-[12px] rotate-[-45deg] rounded-full bg-[#0b0b0f]" />
						<div className="absolute bottom-[13px] right-[7px] h-[2px] w-[8px] rotate-[-45deg] rounded-full bg-[#0b0b0f]" />
					</div>
				</div>
			) : null}
		</div>
	);
}
