import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime", // .mov
  "video/x-msvideo", // .avi
  "video/webm",
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("video") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No video file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      return NextResponse.json(
        { 
          error: "Invalid file type. Allowed types: MP4, MOV, AVI, WebM",
          receivedType: file.type 
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { 
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
          receivedSize: `${(file.size / (1024 * 1024)).toFixed(2)}MB`
        },
        { status: 400 }
      );
    }

    // Get file buffer
    const bytes = await file.arrayBuffer();
    const uint8Array = new Uint8Array(bytes);

    // Define target path - always save as intro.mp4
    const publicDir = path.join(process.cwd(), "public");
    const targetPath = path.join(publicDir, "intro.mp4");

    // Backup existing file if it exists
    if (existsSync(targetPath)) {
      const backupPath = path.join(publicDir, `intro_backup_${Date.now()}.mp4`);
      try {
        const { copyFile } = await import("fs/promises");
        await copyFile(targetPath, backupPath);
      } catch (backupError) {
        console.warn("Could not create backup:", backupError);
      }
    }

    // Write the new file
    await writeFile(targetPath, uint8Array);

    return NextResponse.json({
      success: true,
      message: "Video uploaded successfully",
      filename: "intro.mp4",
      size: file.size,
      originalName: file.name,
    });
  } catch (error) {
    console.error("Video upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload video", details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Check if intro video exists
  const publicDir = path.join(process.cwd(), "public");
  const videoPath = path.join(publicDir, "intro.mp4");
  
  return NextResponse.json({
    exists: existsSync(videoPath),
    path: "/intro.mp4",
  });
}
