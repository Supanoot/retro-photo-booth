"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { Camera, Upload, Download, Share2, RotateCcw, Plus, X, Check } from "lucide-react"

interface PhotoFrame {
  id: string
  imageData: string
}

type AppStep =
  | "choose-method"
  | "camera-preview"
  | "camera-capture"
  | "gallery-select"
  | "creating-magic"
  | "preview-strip"

type FilterType = "natural" | "blackwhite"

export default function ModernPhotoBooth() {
  const [currentStep, setCurrentStep] = useState<AppStep>("choose-method")
  const [selectedPhotos, setSelectedPhotos] = useState<PhotoFrame[]>([])
  const [photoStrip, setPhotoStrip] = useState<PhotoFrame[]>([])
  const [isCapturing, setIsCapturing] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [showCamera, setShowCamera] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("natural")
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [showPhotoReview, setShowPhotoReview] = useState(false)
  const [currentCapturedPhoto, setCurrentCapturedPhoto] = useState<string | null>(null)
  const [showCameraModal, setShowCameraModal] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const startCamera = async () => {
    try {
      setCameraError(null)
      setShowCamera(false) // Reset camera state
      setShowCameraModal(true)

      // Stop any existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }

      // Add a small delay to ensure modal is rendered
      await new Promise((resolve) => setTimeout(resolve, 100))

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
        },
        audio: false,
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream

        // Force video to load and play
        const playPromise = videoRef.current.play()

        videoRef.current.onloadedmetadata = () => {
          console.log("Video metadata loaded")
          setShowCamera(true)
        }

        videoRef.current.oncanplay = () => {
          console.log("Video can play")
          setShowCamera(true)
        }

        // Handle play promise
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log("Video playing successfully")
              setShowCamera(true)
            })
            .catch((error) => {
              console.error("Error playing video:", error)
              // Try to play again after a short delay
              setTimeout(() => {
                if (videoRef.current) {
                  videoRef.current.play().catch(console.error)
                }
              }, 500)
            })
        }
      }
    } catch (error) {
      console.error("Error accessing camera:", error)
      setCameraError("Unable to access camera. Please check permissions and try again.")
      setShowCamera(false)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setShowCamera(false)
    setShowCameraModal(false)
    setCameraError(null)
  }

  const startCountdown = useCallback(() => {
    setCountdown(3)
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === 1) {
          clearInterval(timer)
          capturePhoto()
          return null
        }
        return prev ? prev - 1 : null
      })
    }, 1000)
  }, [])

  const takeSinglePhoto = () => {
    setCurrentStep("camera-capture")
    setCurrentFrame(0)
    setSelectedPhotos([])
    setTimeout(() => {
      startCountdown()
    }, 500)
  }

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return

    const canvas = canvasRef.current
    const video = videoRef.current
    const ctx = canvas.getContext("2d")

    if (!ctx) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Add flash effect
    setIsCapturing(true)
    setTimeout(() => setIsCapturing(false), 200)

    ctx.drawImage(video, 0, 0)
    const imageData = canvas.toDataURL("image/jpeg", 0.8)

    // Show photo review instead of auto-adding
    setCurrentCapturedPhoto(imageData)
    setShowPhotoReview(true)
  }, [])

  const keepPhoto = () => {
    if (!currentCapturedPhoto) return

    const newFrame: PhotoFrame = {
      id: `frame-${Date.now()}`,
      imageData: currentCapturedPhoto,
    }

    setSelectedPhotos((prev) => [...prev, newFrame])
    setCurrentCapturedPhoto(null)
    setShowPhotoReview(false)
    setCurrentFrame((prev) => prev + 1)

    if (currentFrame >= 3) {
      // 4 frames total (0, 1, 2, 3)
      const finalStrip = createFinalStrip([...selectedPhotos, newFrame])
      setPhotoStrip(finalStrip)
      stopCamera()
      setCurrentStep("preview-strip")
      setCurrentFrame(0)
    } else {
      // Continue to next frame after a short delay
      setTimeout(() => {
        startCountdown()
      }, 1000)
    }
  }

  const retakePhoto = () => {
    setCurrentCapturedPhoto(null)
    setShowPhotoReview(false)
    // Start countdown again for the same frame
    setTimeout(() => {
      startCountdown()
    }, 500)
  }

  const cropImageTo43 = (imageData: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          resolve(imageData)
          return
        }

        // Set canvas to 4:3 ratio
        const targetRatio = 4 / 3
        let sourceWidth = img.width
        let sourceHeight = img.height
        let sourceX = 0
        let sourceY = 0

        // Calculate crop dimensions to maintain 4:3 ratio
        const sourceRatio = sourceWidth / sourceHeight

        if (sourceRatio > targetRatio) {
          // Image is wider than 4:3, crop width
          sourceWidth = sourceHeight * targetRatio
          sourceX = (img.width - sourceWidth) / 2
        } else {
          // Image is taller than 4:3, crop height
          sourceHeight = sourceWidth / targetRatio
          sourceY = (img.height - sourceHeight) / 2
        }

        // Set canvas size
        canvas.width = 400
        canvas.height = 300 // 4:3 ratio

        // Draw cropped image
        ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height)

        resolve(canvas.toDataURL("image/jpeg", 0.8))
      }
      img.src = imageData
    })
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    // If this is the first time selecting files, go to gallery-select step
    if (currentStep === "choose-method") {
      setCurrentStep("gallery-select")
    }

    // Process files and add them to existing photos (up to 4 total)
    const availableSlots = 4 - selectedPhotos.length
    const filesToProcess = files.slice(0, availableSlots)

    for (const file of filesToProcess) {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const originalImageData = e.target?.result as string
        const croppedImageData = await cropImageTo43(originalImageData)

        const newPhoto: PhotoFrame = {
          id: `gallery-${Date.now()}-${Math.random()}`,
          imageData: croppedImageData,
        }
        setSelectedPhotos((prev) => [...prev, newPhoto])
      }
      reader.readAsDataURL(file)
    }

    // Reset file input to allow re-selection
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const removePhoto = (photoId: string) => {
    setSelectedPhotos((prev) => prev.filter((photo) => photo.id !== photoId))
  }

  const addMorePhotos = () => {
    if (fileInputRef.current && selectedPhotos.length < 4) {
      fileInputRef.current.click()
    }
  }

  const createFinalStrip = (photos: PhotoFrame[]): PhotoFrame[] => {
    if (photos.length === 0) return []

    // Always create exactly 4 frames
    const finalFrames: PhotoFrame[] = []

    for (let i = 0; i < 4; i++) {
      if (photos[i]) {
        // Use the actual photo if available
        finalFrames.push(photos[i])
      } else {
        // Duplicate from existing photos cyclically
        const sourceIndex = i % photos.length
        finalFrames.push({
          id: `duplicated-${i}-${Date.now()}`,
          imageData: photos[sourceIndex].imageData,
        })
      }
    }

    return finalFrames
  }

  const generatePhotoStrip = () => {
    if (selectedPhotos.length === 0) return

    // Show cute loading animation first
    setCurrentStep("creating-magic")

    // Create the final strip after a delay
    setTimeout(() => {
      const finalStrip = createFinalStrip(selectedPhotos)
      setPhotoStrip(finalStrip)
      setCurrentStep("preview-strip")
    }, 3000) // 3 second cute loading animation
  }

  // Function to apply black and white filter to an image - matches CSS grayscale filter
  const applyBlackWhiteFilter = (imageData: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          resolve(imageData)
          return
        }

        canvas.width = img.width
        canvas.height = img.height

        // Draw the original image
        ctx.drawImage(img, 0, 0)

        // Get image data and apply simple grayscale filter (matches CSS grayscale)
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imgData.data

        // Simple grayscale conversion - matches CSS grayscale filter
        for (let i = 0; i < data.length; i += 4) {
          // Use the same luminance formula as CSS grayscale filter
          const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
          data[i] = gray // Red
          data[i + 1] = gray // Green
          data[i + 2] = gray // Blue
          // Alpha channel (data[i + 3]) remains unchanged
        }

        ctx.putImageData(imgData, 0, 0)
        resolve(canvas.toDataURL("image/jpeg", 0.98))
      }
      img.crossOrigin = "anonymous"
      img.src = imageData
    })
  }

  const generatePhotoStripCanvas = async (): Promise<HTMLCanvasElement> => {
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Could not get canvas context")

    // High-resolution canvas - 3x scale for crisp quality
    const scale = 3
    const stripWidth = 240 * scale // 720px instead of 240px
    const stripPadding = 16 * scale // 48px instead of 16px
    const frameGap = 12 * scale // 36px instead of 12px

    // Calculate frame dimensions at high resolution
    const availableWidth = stripWidth - stripPadding * 2
    const frameWidth = availableWidth
    const frameHeight = Math.round((frameWidth * 3) / 4) // Perfect 4:3 ratio

    // Calculate total height
    const totalFramesHeight = frameHeight * 4 + frameGap * 3
    const bottomTextSpace = 80 * scale
    const stripHeight = stripPadding * 2 + totalFramesHeight + bottomTextSpace

    canvas.width = stripWidth
    canvas.height = stripHeight

    // Enable high-quality rendering
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"

    // Create exact same background as preview
    ctx.fillStyle = "#f5f1e8"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw frames with proper cropping (like object-fit: cover)
    for (let index = 0; index < photoStrip.length; index++) {
      const frame = photoStrip[index]
      let imageDataToUse = frame.imageData

      // Apply filter if black and white is selected
      if (selectedFilter === "blackwhite") {
        imageDataToUse = await applyBlackWhiteFilter(frame.imageData)
      }

      const img = new Image()
      await new Promise<void>((resolve) => {
        img.onload = () => {
          const frameX = stripPadding
          const frameY = stripPadding + index * (frameHeight + frameGap)

          // Calculate how to crop the image to fit the frame (like object-fit: cover)
          const imgAspectRatio = img.width / img.height
          const frameAspectRatio = frameWidth / frameHeight

          let sourceX = 0
          let sourceY = 0
          let sourceWidth = img.width
          let sourceHeight = img.height

          if (imgAspectRatio > frameAspectRatio) {
            // Image is wider than frame - crop width
            sourceWidth = img.height * frameAspectRatio
            sourceX = (img.width - sourceWidth) / 2
          } else {
            // Image is taller than frame - crop height
            sourceHeight = img.width / frameAspectRatio
            sourceY = (img.height - sourceHeight) / 2
          }

          // Draw the cropped image to fit the frame perfectly
          ctx.drawImage(
            img,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight, // Source rectangle (cropped)
            frameX,
            frameY,
            frameWidth,
            frameHeight, // Destination rectangle
          )
          resolve()
        }
        img.crossOrigin = "anonymous"
        img.src = imageDataToUse
      })
    }

    // Add branding text at high resolution
    const textAreaStart = stripPadding + totalFramesHeight
    const textAreaCenter = textAreaStart + bottomTextSpace / 2

    // "Photo Collection" text - scaled up
    ctx.fillStyle = "#374151"
    ctx.font = `bold ${12 * scale}px Inter`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("PHOTO COLLECTION", stripWidth / 2, textAreaCenter - 12 * scale)

    // Date text - scaled up
    ctx.fillStyle = "#6B7280"
    ctx.font = `300 ${10 * scale}px Inter`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    const dateText = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    ctx.fillText(dateText, stripWidth / 2, textAreaCenter + 12 * scale)

    return canvas
  }

  const downloadPhotoStrip = async () => {
    if (photoStrip.length === 0) return

    const canvas = await generatePhotoStripCanvas()
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.98) // Increased from 0.95 to 0.98
    })

    if (!blob) return

    const url = URL.createObjectURL(blob)
    const filename = `photo-strip-${selectedFilter}-${Date.now()}.jpg`

    // Check if Web Share API is available and supports files
    const canShare =
      navigator.share &&
      navigator.canShare &&
      navigator.canShare({ files: [new File([blob], filename, { type: "image/jpeg" })] })

    if (canShare) {
      try {
        await navigator.share({
          files: [new File([blob], filename, { type: "image/jpeg" })],
          title: "Photo Collection",
        })
        return // Successfully shared, no need to download
      } catch (error) {
        console.log("Sharing failed, falling back to download:", error)
        // Fall through to regular download
      }
    }

    // Fallback to regular download
    const link = document.createElement("a")
    link.download = filename
    link.href = url
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // Clean up the URL
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }

  const sharePhotoStrip = async () => {
    if (photoStrip.length === 0) return

    try {
      const canvas = await generatePhotoStripCanvas()
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.98) // Increased from 0.95 to 0.98
      })

      if (!blob) return

      const file = new File([blob], "photo-collection.jpg", { type: "image/jpeg" })

      // Check if Web Share API is available and supports files
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "Photo Collection",
          text: "Check out my photo collection!",
          files: [file],
        })
      } else if (navigator.share) {
        // Fallback to sharing URL if file sharing is not supported
        await navigator.share({
          title: "Photo Collection",
          text: "Check out my photo collection!",
          url: window.location.href,
        })
      } else {
        // Fallback for browsers without Web Share API
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(window.location.href)
          alert("Link copied to clipboard! Share it with your friends.")
        } else {
          // Final fallback - create a temporary input to copy the URL
          const textArea = document.createElement("textarea")
          textArea.value = window.location.href
          document.body.appendChild(textArea)
          textArea.select()
          document.execCommand("copy")
          document.body.removeChild(textArea)
          alert("Link copied to clipboard! Share it with your friends.")
        }
      }
    } catch (error) {
      console.error("Error sharing:", error)
      // Fallback to copying URL
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(window.location.href)
          alert("Sharing failed, but link copied to clipboard!")
        } else {
          alert("Sharing not available on this device. You can manually share this page URL.")
        }
      } catch (clipboardError) {
        alert("Sharing not available on this device. You can manually share this page URL.")
      }
    }
  }

  const resetApp = () => {
    setCurrentStep("choose-method")
    setSelectedPhotos([])
    setPhotoStrip([])
    setCurrentFrame(0)
    setShowPhotoReview(false)
    setCurrentCapturedPhoto(null)
    stopCamera()
    setSelectedFilter("natural")
    setCameraError(null)
  }

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  const getStepProgress = () => {
    switch (currentStep) {
      case "choose-method":
        return 25
      case "camera-preview":
        return 40
      case "camera-capture":
      case "gallery-select":
        return 60
      case "creating-magic":
        return 80
      case "preview-strip":
        return 100
      default:
        return 0
    }
  }

  const ModernProgressBar = ({ progress }: { progress: number }) => {
    return (
      <div className="w-full mb-6 relative">
        {/* Cloud emoji on top of progress */}
        <div className="relative mb-2">
          <div
            className="absolute top-0 transition-all duration-1000 ease-out transform -translate-x-1/2"
            style={{ left: `${progress}%` }}
          >
            <div className="text-2xl animate-float">☁️</div>
          </div>
        </div>

        <div className="relative h-2 bg-white/40 rounded-full overflow-hidden shadow-inner mt-8">
          {/* Animated background pattern */}
          <div className="absolute inset-0 opacity-30">
            <div className="flex h-full items-center justify-around">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="text-[#A8BDDC] text-xs animate-pulse opacity-50"
                  style={{ animationDelay: `${i * 0.3}s` }}
                >
                  ✨
                </div>
              ))}
            </div>
          </div>

          {/* Progress fill with gradient */}
          <div
            className="h-full bg-gradient-to-r from-[#A8BDDC] via-[#B8CDEC] to-[#A8BDDC] transition-all duration-1000 ease-out rounded-full relative overflow-hidden"
            style={{ width: `${progress}%` }}
          >
            {/* Animated shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
          </div>
        </div>
        <div className="flex justify-between mt-3 text-xs text-[#666666] font-medium tracking-wider">
          <span>START</span>
          <span>PROGRESS</span>
          <span>COMPLETE</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#E5EFEE] font-['Inter'] flex flex-col">
      {/* Main App Container - 100vh */}
      <div className="h-screen bg-[#E5EFEE] relative overflow-hidden flex flex-col">
        {/* Clean Animated Header - Like Awwwards */}
        <div className="flex-shrink-0 h-16 bg-white/30 backdrop-blur-sm border-b border-[#A8BDDC]/20 overflow-hidden relative flex items-center">
          {/* Animated sliding text - seamless loop like Awwwards */}
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
            <div className="animate-marquee-seamless whitespace-nowrap flex items-center text-[#666666] font-medium text-sm">
              <span className="mx-8">✨ Create magical photo collections</span>
              <span className="mx-8">🌸 Share beautiful memories</span>
              <span className="mx-8">📸 Capture precious moments</span>
              <span className="mx-8">💫 Curate your story</span>
              <span className="mx-8">🎨 Design your vision</span>
              <span className="mx-8">🌟 Shine bright</span>
              <span className="mx-8">✨ Create magical photo collections</span>
              <span className="mx-8">🌸 Share beautiful memories</span>
              <span className="mx-8">📸 Capture precious moments</span>
              <span className="mx-8">💫 Curate your story</span>
              <span className="mx-8">🎨 Design your vision</span>
              <span className="mx-8">🌟 Shine bright</span>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 px-6 lg:px-8 py-6 lg:py-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto h-full flex flex-col">
              {/* Header Section */}
              <div className="text-center mb-8 lg:mb-12">
                <h1 className="text-3xl lg:text-4xl font-light text-[#484848] tracking-wider leading-tight mb-4">
                  PHOTO
                  <br />
                  <span className="text-[#666666]">COLLECTION</span>
                </h1>
                <div className="w-16 h-px bg-[#A8BDDC] mx-auto mb-6"></div>
                <p className="text-[#666666] font-light tracking-wide text-sm max-w-md mx-auto leading-relaxed">
                  Create a curated series of moments.
                  <br />
                  Four frames, infinite possibilities.
                </p>
              </div>

              <ModernProgressBar progress={getStepProgress()} />

              <div className="text-xs text-[#666666] font-medium tracking-widest uppercase text-center mb-8">
                {currentStep === "camera-preview" && "Camera Ready"}
                {currentStep === "camera-capture" && `Frame ${currentFrame + 1} of 4`}
                {currentStep === "gallery-select" && "Curate Selection"}
                {currentStep === "creating-magic" && "Creating Magic"}
                {currentStep === "preview-strip" && "Collection Ready"}
              </div>

              {/* Content Area */}
              <div className="flex-1 flex items-center justify-center pb-16">
                {/* Step 1: Choose Method */}
                {currentStep === "choose-method" && (
                  <div className="w-full max-w-2xl">
                    <div className="text-center mb-8">
                      <h2 className="text-2xl lg:text-3xl font-light text-[#484848] mb-4 tracking-wide">
                        Choose Your Method
                      </h2>
                      <p className="text-[#666666] font-light leading-relaxed">
                        Begin your collection with camera capture or gallery curation
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <button
                        onClick={startCamera}
                        className="group p-4 lg:p-6 bg-white/60 backdrop-blur-sm border border-[#A8BDDC]/30 hover:border-[#A8BDDC] transition-all duration-500 hover:bg-white/80 rounded-lg"
                      >
                        <Camera className="w-6 h-6 text-[#A8BDDC] mx-auto mb-4 group-hover:scale-110 transition-transform duration-300" />
                        <h3 className="text-base font-medium text-[#484848] mb-2 tracking-wide">CAPTURE</h3>
                        <p className="text-sm text-[#666666] font-light leading-relaxed">
                          Take four photos with your camera
                        </p>
                      </button>

                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="group p-4 lg:p-6 bg-white/60 backdrop-blur-sm border border-[#A8BDDC]/30 hover:border-[#A8BDDC] transition-all duration-500 hover:bg-white/80 rounded-lg"
                      >
                        <Upload className="w-6 h-6 text-[#A8BDDC] mx-auto mb-4 group-hover:scale-110 transition-transform duration-300" />
                        <h3 className="text-base font-medium text-[#484848] mb-2 tracking-wide">GALLERY</h3>
                        <p className="text-sm text-[#666666] font-light leading-relaxed">
                          Choose photos from your gallery
                        </p>
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </div>
                  </div>
                )}

                {/* Step 4: Gallery Selection */}
                {currentStep === "gallery-select" && (
                  <div className="w-full max-w-4xl">
                    <div className="text-center mb-8">
                      <h2 className="text-2xl lg:text-3xl font-light text-[#484848] mb-4 tracking-wide">
                        Your Selection
                      </h2>
                      <p className="text-[#666666] font-light leading-relaxed">
                        {selectedPhotos.length} images selected — Collection of four frames
                      </p>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="aspect-[4/3] relative">
                          {selectedPhotos[index] ? (
                            <div className="relative group rounded-lg overflow-hidden">
                              <img
                                src={selectedPhotos[index].imageData || "/placeholder.svg"}
                                alt={`Selected ${index + 1}`}
                                className="w-full h-full object-cover bg-gray-100 transition-all duration-300 group-hover:opacity-80"
                              />
                              <button
                                onClick={() => removePhoto(selectedPhotos[index].id)}
                                className="absolute top-2 right-2 w-6 h-6 bg-white/90 backdrop-blur-sm text-[#A8BDDC] hover:text-[#484848] opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center rounded-full"
                              >
                                <X className="w-3 h-3" />
                              </button>
                              <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 text-xs font-medium text-[#484848] rounded">
                                {index + 1}
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={addMorePhotos}
                              disabled={selectedPhotos.length >= 4}
                              className="w-full h-full border-2 border-dashed border-[#A8BDDC]/50 bg-white/30 hover:border-[#A8BDDC] hover:bg-white/50 transition-all duration-300 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
                            >
                              <div className="text-center">
                                <Plus className="w-6 h-6 text-[#A8BDDC] group-hover:scale-110 transition-transform duration-300 mx-auto mb-2" />
                                <div className="text-xs text-[#666666] font-medium tracking-wider">ADD</div>
                              </div>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-center gap-4">
                      <button
                        onClick={generatePhotoStrip}
                        disabled={selectedPhotos.length === 0}
                        className="px-6 py-3 bg-[#A8BDDC] hover:bg-[#9AAFDB] text-white font-medium tracking-wider text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 rounded-lg shadow-lg hover:shadow-xl"
                      >
                        <Check className="w-4 h-4" />
                        CREATE COLLECTION
                      </button>
                      <button
                        onClick={resetApp}
                        className="px-6 py-3 bg-white/60 backdrop-blur-sm border border-[#A8BDDC]/30 hover:border-[#A8BDDC] text-[#666666] hover:text-[#484848] font-medium tracking-wider text-sm transition-all duration-300 flex items-center gap-3 rounded-lg"
                      >
                        <RotateCcw className="w-4 h-4" />
                        RESET
                      </button>
                    </div>

                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                )}

                {/* Step 4.5: Creating Magic Animation */}
                {currentStep === "creating-magic" && (
                  <div className="w-full max-w-2xl text-center">
                    <div className="mb-8">
                      <h2 className="text-2xl lg:text-3xl font-light text-[#484848] mb-4 tracking-wide">
                        Creating Magic
                      </h2>
                      <p className="text-[#666666] font-light leading-relaxed">
                        Please wait, your photos are printing...
                      </p>
                    </div>

                    {/* Cute Animation Container */}
                    <div className="bg-white/60 backdrop-blur-sm border border-[#A8BDDC]/30 rounded-lg p-12 mb-8">
                      <div className="relative flex items-center justify-center h-32">
                        {/* Teddy Bear reaching for Heart */}
                        <div className="relative">
                          {/* Teddy Bear */}
                          <div className="text-6xl animate-bounce-slow">🧸</div>

                          {/* Sparkling Heart */}
                          <div
                            className="absolute -top-4 -right-8 text-4xl animate-float"
                            style={{ animationDelay: "0.5s" }}
                          >
                            💖
                          </div>

                          {/* Sparkles around */}
                          <div
                            className="absolute -top-2 -left-6 text-2xl animate-twinkle"
                            style={{ animationDelay: "0.2s" }}
                          >
                            ✨
                          </div>
                          <div
                            className="absolute -bottom-2 right-4 text-xl animate-twinkle"
                            style={{ animationDelay: "0.8s" }}
                          >
                            ✨
                          </div>
                          <div
                            className="absolute top-8 -left-8 text-lg animate-twinkle"
                            style={{ animationDelay: "1.2s" }}
                          >
                            ⭐
                          </div>
                          <div
                            className="absolute -top-6 right-2 text-lg animate-twinkle"
                            style={{ animationDelay: "1.5s" }}
                          >
                            💫
                          </div>
                        </div>
                      </div>

                      {/* Cute Messages */}
                      <div className="mt-8 space-y-2">
                        <p className="text-[#484848] font-medium tracking-wide animate-pulse">
                          Sprinkling some magic dust... ✨
                        </p>
                        <p className="text-[#666666] font-light text-sm">
                          Your beautiful memories are being crafted with love
                        </p>
                      </div>

                      {/* Loading dots */}
                      <div className="flex justify-center items-center mt-6 space-x-2">
                        <div className="w-2 h-2 bg-[#A8BDDC] rounded-full animate-bounce"></div>
                        <div
                          className="w-2 h-2 bg-[#A8BDDC] rounded-full animate-bounce"
                          style={{ animationDelay: "0.1s" }}
                        ></div>
                        <div
                          className="w-2 h-2 bg-[#A8BDDC] rounded-full animate-bounce"
                          style={{ animationDelay: "0.2s" }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 5: Preview Strip */}
                {currentStep === "preview-strip" && (
                  <div className="w-full max-w-3xl">
                    <div className="text-center mb-8">
                      <h3 className="text-2xl lg:text-3xl font-light text-[#484848] mb-4 tracking-wide">
                        Collection Complete
                      </h3>
                      <p className="text-[#666666] font-light leading-relaxed">
                        Your curated series is ready for presentation
                      </p>
                    </div>

                    {/* Filter Selection */}
                    <div className="mb-8">
                      <div className="flex justify-center gap-8">
                        <button
                          onClick={() => setSelectedFilter("natural")}
                          className={`px-4 py-2 font-medium tracking-wider text-sm transition-all duration-300 rounded-lg ${
                            selectedFilter === "natural"
                              ? "text-[#484848] bg-white/60 border border-[#A8BDDC]"
                              : "text-[#666666] hover:text-[#484848] bg-white/30 border border-transparent hover:border-[#A8BDDC]/30"
                          }`}
                        >
                          NATURAL
                        </button>
                        <button
                          onClick={() => setSelectedFilter("blackwhite")}
                          className={`px-4 py-2 font-medium tracking-wider text-sm transition-all duration-300 rounded-lg ${
                            selectedFilter === "blackwhite"
                              ? "text-[#484848] bg-white/60 border border-[#A8BDDC]"
                              : "text-[#666666] hover:text-[#484848] bg-white/30 border border-transparent hover:border-[#A8BDDC]/30"
                          }`}
                        >
                          MONOCHROME
                        </button>
                      </div>
                    </div>

                    {/* Photo Strip Preview - Layered Effect */}
                    <div className="relative mb-8 flex items-center justify-center min-h-[600px]">
                      {/* Background Photo Strips */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        {/* Background Strip 1 */}
                        <div
                          className="absolute bg-[#f5f1e8] p-4 shadow-2xl transform -rotate-3 translate-x-8 translate-y-4 opacity-60"
                          style={{
                            width: "200px",
                            filter: "blur(0.5px)",
                          }}
                        >
                          <div className="space-y-2">
                            {(photoStrip.length > 0 ? photoStrip : createFinalStrip(selectedPhotos)).map(
                              (frame, index) => (
                                <div key={`bg1-${frame.id}`} className="relative">
                                  <div className="overflow-hidden aspect-[4/3] bg-gray-200 rounded-sm">
                                    <img
                                      src={frame.imageData || "/placeholder.svg"}
                                      alt={`Background Frame ${index + 1}`}
                                      className={`w-full h-full object-cover transition-all duration-300 ${
                                        selectedFilter === "blackwhite" ? "grayscale" : ""
                                      }`}
                                    />
                                  </div>
                                </div>
                              ),
                            )}
                          </div>
                          <div className="text-center mt-3 text-xs text-gray-600 font-light tracking-wider">
                            Photo / Booth
                          </div>
                        </div>

                        {/* Background Strip 2 */}
                        <div
                          className="absolute bg-[#f5f1e8] p-4 shadow-xl transform rotate-2 -translate-x-12 translate-y-8 opacity-40"
                          style={{
                            width: "200px",
                            filter: "blur(1px)",
                          }}
                        >
                          <div className="space-y-2">
                            {(photoStrip.length > 0 ? photoStrip : createFinalStrip(selectedPhotos)).map(
                              (frame, index) => (
                                <div key={`bg2-${frame.id}`} className="relative">
                                  <div className="overflow-hidden aspect-[4/3] bg-gray-200 rounded-sm">
                                    <img
                                      src={frame.imageData || "/placeholder.svg"}
                                      alt={`Background Frame ${index + 1}`}
                                      className={`w-full h-full object-cover transition-all duration-300 ${
                                        selectedFilter === "blackwhite" ? "grayscale" : ""
                                      }`}
                                    />
                                  </div>
                                </div>
                              ),
                            )}
                          </div>
                          <div className="text-center mt-3 text-xs text-gray-600 font-light tracking-wider">
                            Memory / Strip
                          </div>
                        </div>

                        {/* Background Strip 3 */}
                        <div
                          className="absolute bg-[#f5f1e8] p-4 shadow-lg transform -rotate-1 translate-x-16 -translate-y-6 opacity-30"
                          style={{
                            width: "200px",
                            filter: "blur(1.5px)",
                          }}
                        >
                          <div className="space-y-2">
                            {(photoStrip.length > 0 ? photoStrip : createFinalStrip(selectedPhotos)).map(
                              (frame, index) => (
                                <div key={`bg3-${frame.id}`} className="relative">
                                  <div className="overflow-hidden aspect-[4/3] bg-gray-200 rounded-sm">
                                    <img
                                      src={frame.imageData || "/placeholder.svg"}
                                      alt={`Background Frame ${index + 1}`}
                                      className={`w-full h-full object-cover transition-all duration-300 ${
                                        selectedFilter === "blackwhite" ? "grayscale" : ""
                                      }`}
                                    />
                                  </div>
                                </div>
                              ),
                            )}
                          </div>
                          <div className="text-center mt-3 text-xs text-gray-600 font-light tracking-wider">
                            Vintage / Booth
                          </div>
                        </div>
                      </div>

                      {/* Main Photo Strip - On Top */}
                      <div
                        className="relative bg-[#f5f1e8] p-6 shadow-2xl transform rotate-1 hover:rotate-0 transition-all duration-700 hover:scale-105 cursor-pointer z-10"
                        style={{
                          width: "240px",
                          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)",
                        }}
                      >
                        <div className="space-y-3">
                          {(photoStrip.length > 0 ? photoStrip : createFinalStrip(selectedPhotos)).map(
                            (frame, index) => (
                              <div key={frame.id} className="relative group">
                                <div className="overflow-hidden aspect-[4/3] bg-gray-100 rounded-sm shadow-inner">
                                  <img
                                    src={frame.imageData || "/placeholder.svg"}
                                    alt={`Frame ${index + 1}`}
                                    className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${
                                      selectedFilter === "blackwhite" ? "grayscale" : ""
                                    }`}
                                  />
                                </div>
                              </div>
                            ),
                          )}
                        </div>

                        {/* Authentic photo strip branding */}
                        <div className="text-center mt-4 space-y-1">
                          <div className="text-xs text-gray-700 font-medium tracking-[0.2em] uppercase">
                            Photo Collection
                          </div>
                          <div className="text-xs text-gray-500 font-light tracking-wider">
                            {new Date().toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-center gap-4 mb-6">
                      <button
                        onClick={downloadPhotoStrip}
                        className="px-6 py-3 bg-[#A8BDDC] hover:bg-[#9AAFDB] text-white font-medium tracking-wider text-sm transition-all duration-300 flex items-center gap-3 rounded-lg shadow-lg hover:shadow-xl"
                      >
                        <Download className="w-4 h-4" />
                        DOWNLOAD
                      </button>
                      <button
                        onClick={sharePhotoStrip}
                        className="px-6 py-3 bg-white/60 backdrop-blur-sm border border-[#A8BDDC]/30 hover:border-[#A8BDDC] text-[#666666] hover:text-[#484848] font-medium tracking-wider text-sm transition-all duration-300 flex items-center gap-3 rounded-lg"
                      >
                        <Share2 className="w-4 h-4" />
                        SHARE
                      </button>
                    </div>

                    <div className="text-center">
                      <button
                        onClick={resetApp}
                        className="text-[#666666] hover:text-[#484848] font-light tracking-wider text-sm transition-all duration-300 flex items-center gap-2 mx-auto"
                      >
                        <RotateCcw className="w-4 h-4" />
                        CREATE NEW COLLECTION
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Hidden canvas for image processing */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Camera Modal */}
      {showCameraModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-medium text-[#484848] tracking-wide">Camera Preview</h3>
                <p className="text-sm text-[#666666] font-light">
                  {currentStep === "camera-capture"
                    ? `Frame ${currentFrame + 1} of 4`
                    : "Position yourself and start capturing"}
                </p>
              </div>
              <button
                onClick={stopCamera}
                className="w-10 h-10 bg-white/60 backdrop-blur-sm border border-[#A8BDDC]/30 hover:border-[#A8BDDC] text-[#A8BDDC] hover:text-[#484848] transition-all duration-300 flex items-center justify-center rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {cameraError ? (
              <div className="text-center py-12">
                <Camera className="w-12 h-12 mx-auto mb-4 text-red-400" />
                <p className="text-red-600 mb-4">{cameraError}</p>
                <button
                  onClick={startCamera}
                  className="px-6 py-3 bg-[#A8BDDC] hover:bg-[#9AAFDB] text-white font-medium tracking-wider text-sm transition-all duration-300 rounded-lg"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <>
                {/* Camera Preview */}
                <div className="relative mb-6 rounded-xl overflow-hidden bg-gray-900">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full aspect-[4/3] object-cover transition-opacity duration-500 ${
                      showCamera ? "opacity-100" : "opacity-0"
                    }`}
                    style={{ display: showCamera ? "block" : "none" }}
                  />

                  {/* Loading state - only show when camera is not ready */}
                  {!showCamera && !cameraError && (
                    <div className="absolute inset-0 flex items-center justify-center aspect-[4/3]">
                      <div className="text-center text-white">
                        <Camera className="w-8 h-8 mx-auto mb-2 animate-pulse" />
                        <p className="text-sm">Loading camera...</p>
                        <div className="mt-2 flex justify-center space-x-1">
                          <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                          <div
                            className="w-2 h-2 bg-white rounded-full animate-bounce"
                            style={{ animationDelay: "0.1s" }}
                          ></div>
                          <div
                            className="w-2 h-2 bg-white rounded-full animate-bounce"
                            style={{ animationDelay: "0.2s" }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Countdown Overlay */}
                  {countdown && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-10">
                      <div className="text-center">
                        <div className="text-6xl lg:text-8xl font-light text-white mb-4">{countdown}</div>
                        <div className="text-white text-sm font-light tracking-wider uppercase">Get Ready</div>
                      </div>
                    </div>
                  )}

                  {/* Flash Effect */}
                  {isCapturing && <div className="absolute inset-0 bg-white animate-pulse z-10" />}

                  {/* Camera Status */}
                  {showCamera && (
                    <div className="absolute top-4 left-4 z-10">
                      <div className="bg-[#A8BDDC]/90 backdrop-blur-sm px-3 py-1 text-xs font-medium tracking-wider text-white rounded-full flex items-center gap-2 shadow-lg">
                        <div className="text-sm animate-pulse">💗</div>
                        READY
                      </div>
                    </div>
                  )}
                </div>

                {/* Debug Info - Remove this later */}
                {process.env.NODE_ENV === "development" && (
                  <div className="mb-4 p-3 bg-gray-100 rounded text-xs">
                    <p>Camera State: {showCamera ? "Active" : "Loading"}</p>
                    <p>Stream: {streamRef.current ? "Connected" : "None"}</p>
                    <p>Video Element: {videoRef.current ? "Ready" : "Not Ready"}</p>
                    <button
                      onClick={() => {
                        if (videoRef.current && streamRef.current) {
                          videoRef.current.srcObject = streamRef.current
                          videoRef.current.play()
                        }
                      }}
                      className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-xs"
                    >
                      Force Video Play
                    </button>
                  </div>
                )}

                {/* Photo Review Section */}
                {showPhotoReview && currentCapturedPhoto && (
                  <div className="mb-6">
                    <div className="text-center mb-4">
                      <h4 className="text-lg font-medium text-[#484848] mb-2">Frame {currentFrame + 1} Captured</h4>
                      <p className="text-sm text-[#666666]">Keep this photo or retake it?</p>
                    </div>

                    <div className="relative mb-4 rounded-lg overflow-hidden max-w-sm mx-auto">
                      <img
                        src={currentCapturedPhoto || "/placeholder.svg"}
                        alt={`Captured Frame ${currentFrame + 1}`}
                        className="w-full aspect-[4/3] object-cover bg-gray-100"
                      />
                      <div className="absolute top-3 left-3">
                        <div className="bg-white/90 backdrop-blur-sm px-2 py-1 text-xs font-medium tracking-wider text-[#484848] rounded">
                          FRAME {currentFrame + 1}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center gap-3">
                      <button
                        onClick={keepPhoto}
                        className="px-6 py-3 bg-[#A8BDDC] hover:bg-[#9AAFDB] text-white font-medium tracking-wider text-sm transition-all duration-300 flex items-center gap-2 rounded-lg"
                      >
                        <Check className="w-4 h-4" />
                        KEEP
                      </button>
                      <button
                        onClick={retakePhoto}
                        className="px-6 py-3 bg-white/60 backdrop-blur-sm border border-[#A8BDDC]/30 hover:border-[#A8BDDC] text-[#666666] hover:text-[#484848] font-medium tracking-wider text-sm transition-all duration-300 flex items-center gap-2 rounded-lg"
                      >
                        <RotateCcw className="w-4 h-4" />
                        RETAKE
                      </button>
                    </div>
                  </div>
                )}

                {/* Camera Controls */}
                {!showPhotoReview && (
                  <div className="flex justify-center items-center gap-4">
                    <button
                      onClick={takeSinglePhoto}
                      disabled={!showCamera || currentStep === "camera-capture"}
                      className="px-8 py-4 bg-[#A8BDDC] hover:bg-[#9AAFDB] disabled:bg-gray-400 text-white font-medium tracking-wider text-sm transition-all duration-300 rounded-lg shadow-lg hover:shadow-xl disabled:cursor-not-allowed flex items-center gap-3"
                    >
                      <Camera className="w-5 h-5" />
                      {currentStep === "camera-capture" ? "CAPTURING..." : "START CAPTURE"}
                    </button>
                  </div>
                )}

                {/* Captured Photos Preview */}
                {selectedPhotos.length > 0 && (
                  <div className="mt-6">
                    <p className="text-sm text-[#666666] font-medium mb-3 text-center">
                      Captured Photos ({selectedPhotos.length}/4)
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {selectedPhotos.map((photo, index) => (
                        <div key={photo.id} className="relative aspect-[4/3] rounded overflow-hidden">
                          <img
                            src={photo.imageData || "/placeholder.svg"}
                            alt={`Frame ${index + 1}`}
                            className="w-full h-full object-cover bg-gray-100"
                          />
                          <div className="absolute bottom-1 left-1 bg-white/90 backdrop-blur-sm px-1 py-0.5 text-xs font-medium text-[#484848] rounded">
                            {index + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Footer - Outside of 100vh (non-sticky) */}
      <footer className="bg-white/40 backdrop-blur-sm border-t border-[#A8BDDC]/20 py-8 px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Camera className="w-4 h-4 text-[#A8BDDC]" />
              <span className="text-[#484848] font-medium tracking-wider text-sm">PHOTO COLLECTION</span>
            </div>
            <p className="text-[#666666] font-light text-xs tracking-wide mb-4">
              Create beautiful photo collections with our modern photo booth experience
            </p>
            <div className="flex items-center justify-center gap-6 text-xs text-[#666666] font-light">
              <span>© 2024 Photo Collection</span>
              <span>•</span>
              <span>Made with ✨</span>
              <span>•</span>
              <span>Capture Memories</span>
            </div>
          </div>
        </div>
      </footer>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
        
        @keyframes marquee-seamless {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-100%);
          }
        }
        .animate-marquee-seamless {
          animation: marquee-seamless 60s linear infinite;
        }
        
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .animate-shimmer {
          animation: shimmer 2s ease-in-out infinite;
        }

        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          33% {
            transform: translateY(-8px) rotate(5deg);
          }
          66% {
            transform: translateY(-4px) rotate(-3deg);
          }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        @keyframes twinkle {
          0%, 100% {
            opacity: 0.3;
            transform: scale(0.8);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
        }
        .animate-twinkle {
          animation: twinkle 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
