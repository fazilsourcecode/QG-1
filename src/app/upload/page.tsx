
"use client"

import React from "react"

import { zodResolver } from "@hookform/resolvers/zod"
import FileSaver from "file-saver"
import JSZip from "jszip"
import { AlertTriangle, Eye, FileDown, FilesIcon, Plus, RefreshCw, Upload } from "lucide-react"
import { useCallback, useRef, useState } from "react"
import { FormProvider, useForm as useFormHook } from "react-hook-form"
import * as XLSX from "xlsx"
import { z } from "zod"

import { extractHandwrittenMarks, type ExtractHandwrittenMarksOutput } from "@/ai/flows/extract-handwritten-marks"
import { useToast } from "@/hooks/use-toast"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

const UploadFormSchema = z.object({
  files: z.any().refine((files) => {
    if (!files || files.length === 0) return false
    return true
  }, "Please upload at least one file."),
})

type UploadFormValues = z.infer<typeof UploadFormSchema>

type ProcessingStatus = {
  fileName: string
  status: "pending" | "processing" | "success" | "error" | "retrying" | "corrected"
  data?: ExtractHandwrittenMarksOutput & { originalFileName?: string }
  error?: string
  originalFile?: File
  imageUrl?: string
  retryCount?: number
  validationIssues?: ValidationIssue[]
  isManuallyEdited?: boolean
}

type ValidationIssue = {
  type: "multiple_groups" | "total_mismatch" | "missing_parts"
  message: string
  severity: "warning" | "error"
}

// Define the question structure
const questionGroups = {
  // 2-mark questions
  Q1: ["1"],
  Q2: ["2"],
  Q3: ["3"],
  Q4: ["4"],
  Q5: ["5"],
  PartA_Total: ["1", "2", "3", "4", "5"],

  // 6-mark grouped questions
  "6A": ["6a(i)", "6a(ii)", "6a(iii)"],
  "6B": ["6b(i)", "6b(ii)", "6b(iii)"],
  "6C": ["6c(i)", "6c(ii)", "6c(iii)"],
  Q6_Total: ["6A", "6B", "6C"],

  "7A": ["7a(i)", "7a(ii)", "7a(iii)"],
  "7B": ["7b(i)", "7b(ii)", "7b(iii)"],
  "7C": ["7c(i)", "7c(ii)", "7c(iii)"],
  Q7_Total: ["7A", "7B", "7C"],

  "8A": ["8a(i)", "8a(ii)", "8a(iii)"],
  "8B": ["8b(i)", "8b(ii)", "8b(iii)"],
  "8C": ["8c(i)", "8c(ii)", "8c(iii)"],
  Q8_Total: ["8A", "8B", "8C"],
}

// Maximum marks for each question and subpart
const maxMarks = {
  // Individual questions (2 marks each)
  "1": 2,
  "2": 2,
  "3": 2,
  "4": 2,
  "5": 2,
  PartA_Total: 10, // Q1-Q5 total

  // Q6 subparts (each subpart can have max 16, but only one group should be active)
  "6a(i)": 16,
  "6a(ii)": 16,
  "6a(iii)": 16,
  "6b(i)": 16,
  "6b(ii)": 16,
  "6b(iii)": 16,
  "6c(i)": 16,
  "6c(ii)": 16,
  "6c(iii)": 16,
  Q6_Total: 16, // Only one group from 6A, 6B, or 6C should be active

  // Q7 subparts (each subpart can have max 16, but only one group should be active)
  "7a(i)": 16,
  "7a(ii)": 16,
  "7a(iii)": 16,
  "7b(i)": 16,
  "7b(ii)": 16,
  "7b(iii)": 16,
  "7c(i)": 16,
  "7c(ii)": 16,
  "7c(iii)": 16,
  Q7_Total: 16, // Only one group from 7A, 7B, or 7C should be active

  // Q8 subparts (each subpart can have max 8, but only one group should be active)
  "8a(i)": 8,
  "8a(ii)": 8,
  "8a(iii)": 8,
  "8b(i)": 8,
  "8b(ii)": 8,
  "8b(iii)": 8,
  "8c(i)": 8,
  "8c(ii)": 8,
  "8c(iii)": 8,
  Q8_Total: 8, // Only one group from 8A, 8B, or 8C should be active

  Grand_Total: 50, // Total of all the above
}

// Group questions by their main number (6, 7, 8)
const questionsByMainNumber = {
  "6": ["6A", "6B", "6C"],
  "7": ["7A", "7B", "7C"],
  "8": ["8A", "8B", "8C"],
}

// Flatten the question groups for validation
const allQuestionParts = Object.entries(questionGroups)
  .filter(([key]) => !key.includes("_Total"))
  .flatMap(([_, parts]) => parts)

// Define the Excel column structure
const excelColumns = [
  "Name",
  "RRN",
  "Course",
  "Q1",
  "Q2",
  "Q3",
  "Q4",
  "Q5",
  "6A",
  "6B",
  "6C",
  "7A",
  "7B",
  "7C",
  "8A",
  "8B",
  "8C",
  "Total",
  "CO1",
  "CO2",
  "CO3",
]

type CourseOutcomeMapping = {
  CO1: string[]
  CO2: string[]
  CO3: string[]
  [key: string]: string[]
}

export default function UploadPage() {
  const [extractedData, setExtractedData] = useState<ExtractHandwrittenMarksOutput[]>([])
  const [processingStatuses, setProcessingStatuses] = useState<ProcessingStatus[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [excelFileBlob, setExcelFileBlob] = useState<Blob | null>(null)
  const [selectedFile, setSelectedFile] = useState<ExtractHandwrittenMarksOutput | null>(null)
  const [uploadMode, setUploadMode] = useState<"single" | "multiple" | "zip">("single")
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const [autoRetryEnabled, setAutoRetryEnabled] = useState(true)
  const [maxRetryAttempts, setMaxRetryAttempts] = useState(3)
  const [retryDelay, setRetryDelay] = useState(2000)
  const [courseOutcomeMapping, setCourseOutcomeMapping] = useState<CourseOutcomeMapping>({
    CO1: [],
    CO2: [],
    CO3: [],
  })
  const [courseOutcomes, setCourseOutcomes] = useState<string[]>(["CO1", "CO2", "CO3"])
  const [selectedStatus, setSelectedStatus] = useState<ProcessingStatus | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const form = useFormHook<UploadFormValues>({
    resolver: zodResolver(UploadFormSchema),
  })
  
  const openCompareInNewTab = useCallback((statusIndex?: number) => {
    const sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const dataToStore = {
      processingStatuses: processingStatuses,
      extractedData: extractedData,
    }

    localStorage.setItem(`marksheet-compare-${sessionId}`, JSON.stringify(dataToStore))
    const params = new URLSearchParams({
      type: 'cat-3-credits',
      index: statusIndex?.toString() || "0",
      sessionId: sessionId,
    })
    const compareUrl = `/compare?${params.toString()}`
    window.open(compareUrl, "_blank")
  }, [processingStatuses, extractedData]);


  // Helper function for exponential backoff
  const getRetryDelay = (attempt: number) => {
    return Math.min(retryDelay * Math.pow(2, attempt), 30000) // Max 30 seconds
  }

  const processImageFile = async (
    file: File,
  ): Promise<ExtractHandwrittenMarksOutput & { originalFileName?: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onloadend = async () => {
        try {
          const base64String = reader.result as string

          // Security scan (client-side - no file sent to server)
          const { scanFile } = await import("@/lib/file-scanner");
          const scanResult = await scanFile(file);
          console.log("[SECURITY SCAN]", file.name, scanResult);
          if (!scanResult.safe) {
            throw new Error(`BLOCKED: ${scanResult.details}`);
          }

          const result = await extractHandwrittenMarks({ photoUrl: base64String })

          // Process the marks to ensure they follow the required structure
          const processedResult = processExtractedMarks(result)

          // Add the original filename
          const resultWithFilename = {
            ...processedResult,
            originalFileName: file.name,
          }

          resolve(resultWithFilename)
        } catch (error: any) {
          reject(error)
        }
      }

      reader.onerror = () => {
        reject(new Error(`Failed to read file: ${file.name}`))
      }

      reader.readAsDataURL(file)
    })
  }

  // Process extracted marks to ensure they follow the required structure
  const processExtractedMarks = (result: ExtractHandwrittenMarksOutput): ExtractHandwrittenMarksOutput => {
    // Create a map to store the processed marks
    const marksMap = new Map<string, string>()

    // Track which main question numbers (6, 7, 8) have parts detected
    const detectedMainNumbers = new Set<string>()
    const detectedSubGroups = new Map<string, Set<string>>() // e.g., "6" -> Set("a")

    // First pass: Identify which main question numbers and subgroups are present
    result.marks.forEach((mark) => {
      // Clean up the question number format (remove spaces, etc.)
      const cleanQuestionNumber = mark.questionNumber.trim().toLowerCase().replace(/\s+/g, "")

      // Try to parse the question number
      const match = cleanQuestionNumber.match(/(\d+)([a-c])(?:$$([i-iii]+)$$)?/)
      if (match) {
        const [, mainNum, subGroup] = match
        detectedMainNumbers.add(mainNum)

        if (!detectedSubGroups.has(mainNum)) {
          detectedSubGroups.set(mainNum, new Set())
        }
        detectedSubGroups.get(mainNum)?.add(subGroup)
      }
    })

    // Second pass: Process marks based on detected patterns
    result.marks.forEach((mark) => {
      // Clean up the question number format (remove spaces, etc.)
      const cleanQuestionNumber = mark.questionNumber.trim().toLowerCase().replace(/\s+/g, "")

      // Check if this is one of our expected question formats
      if (allQuestionParts.includes(cleanQuestionNumber)) {
        marksMap.set(cleanQuestionNumber, mark.mark)
      } else {
        // Try to parse the question number if it's in a different format
        // For example, "6 a i : 2" should be parsed as "6a(i)" with mark "2"
        const match = cleanQuestionNumber.match(/(\d+)\s*([a-c])\s*([i-iii]+)/)
        if (match) {
          const [, num, letter, roman] = match
          const formattedQuestion = `${num}${letter}(${roman})`

          // Extract the mark value if it's in the format "6 a i : 2"
          const markMatch = mark.questionNumber.match(/:\s*(\d+)/)
          const markValue = markMatch ? markMatch[1] : mark.mark

          if (allQuestionParts.includes(formattedQuestion)) {
            marksMap.set(formattedQuestion, markValue)
          }
        }
      }
    })

    // For each detected main number (6, 7, 8), enforce the rule that only one subgroup (a, b, c) should be present
    detectedMainNumbers.forEach((mainNum) => {
      const subGroups = detectedSubGroups.get(mainNum)
      if (subGroups && subGroups.size > 1) {
        // Multiple subgroups detected for the same main number (e.g., both 6a and 6b)
        // This violates the rule - we need to choose one subgroup based on priority or completeness

        // Strategy: Choose the subgroup with the most parts detected or the first one alphabetically
        let chosenSubGroup = Array.from(subGroups)[0] // Default to first one
        let maxPartsDetected = 0

        for (const subGroup of subGroups) {
          const pattern = new RegExp(`${mainNum}${subGroup}\$$[i-iii]+\$$`)
          const detectedParts = Array.from(marksMap.keys()).filter((key) => pattern.test(key)).length

          if (detectedParts > maxPartsDetected) {
            maxPartsDetected = detectedParts
            chosenSubGroup = subGroup
          }
        }

        // Remove all parts from non-chosen subgroups
        for (const key of Array.from(marksMap.keys())) {
          const subGroupMatch = key.match(new RegExp(`${mainNum}([a-c])\$$[i-iii]+\$$`))
          if (subGroupMatch && subGroupMatch[1] !== chosenSubGroup) {
            marksMap.delete(key)
          }
        }

        // Log a warning about the correction
        console.warn(
          `Detected multiple subgroups for question ${mainNum}. Keeping only ${mainNum}${chosenSubGroup} parts.`,
        )
      }
    })

    // Validate the structure - if we have 6a(i), we should also have 6a(ii) and 6a(iii), not 6b
    Object.entries(questionGroups).forEach(([groupKey, parts]) => {
      // Skip total groups
      if (groupKey.includes("_Total")) return

      // Check if any part of this group exists
      const hasAnyPart = parts.some((part) => marksMap.has(part))

      if (hasAnyPart) {
        // Ensure all parts of this group are present
        parts.forEach((part) => {
          if (!marksMap.has(part)) {
            marksMap.set(part, "0") // Default to 0 if missing
          }
        })
      }
    })

    // Convert the map back to the marks array
    const processedMarks = Array.from(marksMap.entries()).map(([questionNumber, mark]) => ({
      questionNumber,
      mark,
    }))

    return {
      ...result,
      marks: processedMarks,
    }
  }

  // Validate the extracted marks against the expected structure
  const validateExtractedMarks = (data: ExtractHandwrittenMarksOutput): ValidationIssue[] => {
    const issues: ValidationIssue[] = []
    const marksMap = new Map(data.marks.map((m) => [m.questionNumber, Number.parseInt(m.mark) || 0]))

    // Helper function to calculate group total
    const calculateGroupTotal = (groupKey: string): number => {
      if (!questionGroups[groupKey]) return 0

      return questionGroups[groupKey].reduce((sum, part) => {
        return sum + (marksMap.get(part) || 0)
      }, 0)
    }

    // Validate individual question marks against their maximums
    data.marks.forEach((mark) => {
      const markValue = Number.parseInt(mark.mark) || 0
      const maxAllowed = maxMarks[mark.questionNumber]

      if (maxAllowed && markValue > maxAllowed) {
        issues.push({
          type: "total_mismatch",
          message: `${mark.questionNumber}: Mark ${markValue} exceeds maximum allowed (${maxAllowed})`,
          severity: "error",
        })
      }
    })

    // Check for multiple active groups in Q6, Q7, Q8
    ;["6", "7", "8"].forEach((mainNum) => {
      const groups = questionsByMainNumber[mainNum]
      const activeGroups = groups.filter((group) => {
        const total = calculateGroupTotal(group)
        return total > 0
      })

      if (activeGroups.length > 1) {
        issues.push({
          type: "multiple_groups",
          message: `Multiple active groups detected for Q${mainNum}: ${activeGroups.join(", ")}. Only one group should have marks.`,
          severity: "error",
        })
      }
    })

    // Check if the total marks match the expected structure
    const partATotal = ["1", "2", "3", "4", "5"].reduce((sum, q) => sum + (marksMap.get(q) || 0), 0)
    if (partATotal > maxMarks.PartA_Total) {
      issues.push({
        type: "total_mismatch",
        message: `Part A total (${partATotal}) exceeds maximum (${maxMarks.PartA_Total})`,
        severity: "warning",
      })
    }

    // Check Q6 total
    const q6Groups = ["6A", "6B", "6C"]
    const q6ActiveGroup = q6Groups.find((group) => calculateGroupTotal(group) > 0)
    const q6Total = q6ActiveGroup ? calculateGroupTotal(q6ActiveGroup) : 0
    if (q6Total > maxMarks.Q6_Total) {
      issues.push({
        type: "total_mismatch",
        message: `Q6 total (${q6Total}) exceeds maximum (${maxMarks.Q6_Total})`,
        severity: "warning",
      })
    }

    // Check Q7 total
    const q7Groups = ["7A", "7B", "7C"]
    const q7ActiveGroup = q7Groups.find((group) => calculateGroupTotal(group) > 0)
    const q7Total = q7ActiveGroup ? calculateGroupTotal(q7ActiveGroup) : 0
    if (q7Total > maxMarks.Q7_Total) {
      issues.push({
        type: "total_mismatch",
        message: `Q7 total (${q7Total}) exceeds maximum (${maxMarks.Q7_Total})`,
        severity: "warning",
      })
    }

    // Check Q8 total
    const q8Groups = ["8A", "8B", "8C"]
    const q8ActiveGroup = q8Groups.find((group) => calculateGroupTotal(group) > 0)
    const q8Total = q8ActiveGroup ? calculateGroupTotal(q8ActiveGroup) : 0
    if (q8Total > maxMarks.Q8_Total) {
      issues.push({
        type: "total_mismatch",
        message: `Q8 total (${q8Total}) exceeds maximum (${maxMarks.Q8_Total})`,
        severity: "warning",
      })
    }

    // Check grand total
    const calculatedTotal = partATotal + q6Total + q7Total + q8Total
    const declaredTotal = Number.parseInt(data.totalMarks) || 0

    if (Math.abs(calculatedTotal - declaredTotal) > 2) {
      // Allow small discrepancies
      issues.push({
        type: "total_mismatch",
        message: `Calculated total (${calculatedTotal}) doesn't match declared total (${declaredTotal})`,
        severity: "warning",
      })
    }
     if (declaredTotal > maxMarks.Grand_Total) {
        issues.push({
            type: "total_mismatch",
            message: `Declared total (${declaredTotal}) exceeds grand maximum (${maxMarks.Grand_Total})`,
            severity: "error",
        });
    }

    return issues
  }

  const processImages = async (files: FileList) => {
    setIsProcessing(true)
    setProgress(0)
    setExcelFileBlob(null)

    const fileArray = Array.from(files)
    const imageFiles = fileArray.filter(
      (file) => file.type.startsWith("image/") || (uploadMode === "zip" && file.type === "application/zip"),
    )

    if (imageFiles.length === 0) {
      toast({
        variant: "destructive",
        title: "No valid files",
        description: "Please upload image files or a ZIP containing images.",
      })
      setIsProcessing(false)
      return
    }

    const initialStatuses: ProcessingStatus[] = []
    let filesToProcess: File[] = []

    // Handle ZIP files
    if (uploadMode === "zip" && imageFiles.some((file) => file.type === "application/zip")) {
      const zipFile = imageFiles.find((file) => file.type === "application/zip")!

      try {
        const zip = new JSZip()
        const zipContent = await zip.loadAsync(zipFile)

        const extractedFiles: File[] = []
        const zipFilePromises: Promise<void>[] = []

        // Check if ZIP contains any image files
        const imageEntries = Object.keys(zipContent.files).filter(
          (path) =>
            !zipContent.files[path].dir &&
            path.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) &&
            !path.startsWith("__MACOSX/") &&
            !path.startsWith("."),
        )

        if (imageEntries.length === 0) {
          toast({
            variant: "destructive",
            title: "No images found in ZIP",
            description: "The ZIP file doesn't contain any valid image files (JPG, PNG, GIF, etc.).",
          })
          setIsProcessing(false)
          return
        }

        zipContent.forEach((relativePath, zipEntry) => {
          if (
            !zipEntry.dir &&
            relativePath.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) &&
            !relativePath.startsWith("__MACOSX/") &&
            !relativePath.startsWith(".")
          ) {
            const promise = zipEntry
              .async("blob")
              .then((blob) => {
                const extension = relativePath.split(".").pop()?.toLowerCase()
                const mimeType =
                  extension === "jpg" || extension === "jpeg"
                    ? "image/jpeg"
                    : extension === "png"
                      ? "image/png"
                      : extension === "gif"
                        ? "image/gif"
                        : extension === "bmp"
                          ? "image/bmp"
                          : extension === "webp"
                            ? "image/webp"
                            : "image/jpeg"

                const file = new File([blob], relativePath.split("/").pop() || relativePath, { type: mimeType })
                extractedFiles.push(file)

                const imageUrl = URL.createObjectURL(file)

                initialStatuses.push({
                  fileName: relativePath.split("/").pop() || relativePath,
                  status: "pending",
                  originalFile: file,
                  imageUrl: imageUrl,
                  retryCount: 0,
                })
              })
              .catch((error) => {
                console.error(`Failed to extract ${relativePath}:`, error)
              })
            zipFilePromises.push(promise)
          }
        })

        await Promise.all(zipFilePromises)
        filesToProcess = extractedFiles

        if (filesToProcess.length === 0) {
          toast({
            variant: "destructive",
            title: "ZIP processing failed",
            description: "Unable to extract any valid images from the ZIP file.",
          })
          setIsProcessing(false)
          return
        }

        toast({
          title: "ZIP processed successfully",
          description: `Extracted ${filesToProcess.length} image files from the ZIP archive.`,
        })
      } catch (error) {
        console.error("ZIP processing error:", error)
        toast({
          variant: "destructive",
          title: "ZIP processing error",
          description: "Failed to process the ZIP file. Please ensure it's a valid ZIP containing image files.",
        })
        setIsProcessing(false)
        return
      }
    } else {
      // Regular image files
      const validImageFiles = imageFiles.filter((file) => {
        const isValidImage = file.type.startsWith("image/") && file.size > 0
        if (!isValidImage) {
          toast({
            variant: "destructive",
            title: "Invalid file",
            description: `${file.name} is not a valid image file.`,
          })
        }
        return isValidImage
      })

      if (validImageFiles.length === 0) {
        toast({
          variant: "destructive",
          title: "No valid images",
          description: "Please select valid image files.",
        })
        setIsProcessing(false)
        return
      }

      filesToProcess = validImageFiles
      validImageFiles.forEach((file) => {
        const imageUrl = URL.createObjectURL(file)
        initialStatuses.push({
          fileName: file.name,
          status: "pending",
          originalFile: file,
          imageUrl: imageUrl,
          retryCount: 0,
        })
      })
    }

    setProcessingStatuses(initialStatuses)
    await processFilesWithRetry(filesToProcess, initialStatuses)
  }

  const processFilesWithRetry = async (filesToProcess: File[], initialStatuses: ProcessingStatus[]) => {
    const results: ExtractHandwrittenMarksOutput[] = []
    let processed = 0

    // First pass: Process all files
    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i]

      setProcessingStatuses((prev) =>
        prev.map((status, idx) => (idx === i ? { ...status, status: "processing" } : status)),
      )

      try {
        const result = await processImageFile(file)

        // Validate the extracted marks
        const validationIssues = validateExtractedMarks(result)

        setProcessingStatuses((prev) =>
          prev.map((status, idx) =>
            idx === i
              ? {
                  ...status,
                  status: "success",
                  data: result,
                  validationIssues,
                }
              : status,
          ),
        )

        results.push(result)

        // Show validation warnings if any
        if (validationIssues.length > 0) {
          const errorCount = validationIssues.filter((i) => i.severity === "error").length
          const warningCount = validationIssues.filter((i) => i.severity === "warning").length

          toast({
            variant: errorCount > 0 ? "destructive" : "warning",
            title: "Validation Issues Detected",
            description: `${file.name}: ${errorCount} errors, ${warningCount} warnings. Check details for more information.`,
          })
        }
      } catch (error: any) {
        setProcessingStatuses((prev) =>
          prev.map((status, idx) =>
            idx === i ? { ...status, status: "error", error: "Model is unable to extract marks. Please try again." } : status,
          ),
        )
      }

      processed++
      setProgress(Math.round((processed / filesToProcess.length) * 100))
    }

    // Auto-retry failed files if enabled
    if (autoRetryEnabled) {
      await autoRetryFailedFiles(results)
    }

    // Final results
    if (results.length > 0) {
      setExtractedData(results)
      generateExcelFile(results)

      const failedCount = filesToProcess.length - results.length
      toast({
        title: "Processing Complete",
        description: `Successfully processed ${results.length} of ${filesToProcess.length} files.${
          failedCount > 0 ? ` ${failedCount} files failed.` : ""
        }`,
      })
    } else {
      toast({
        variant: "destructive",
        title: "Processing Failed",
        description: "Unable to extract marks from any of the provided images.",
      })
    }

    setIsProcessing(false)
  }

  const autoRetryFailedFiles = async (results: ExtractHandwrittenMarksOutput[]) => {
    const currentStatuses = [...processingStatuses]
    const failedIndices = currentStatuses
      .map((status, index) => ({ status, index }))
      .filter(({ status }) => status.status === "error")
      .map(({ index }) => index)

    if (failedIndices.length === 0) return

    setIsRetrying(true)

    toast({
      title: "Auto-Retry Started",
      description: `Automatically retrying ${failedIndices.length} failed files...`,
    })

    for (const failedIndex of failedIndices) {
      const failedStatus = currentStatuses[failedIndex]
      if (!failedStatus.originalFile) continue

      let retrySuccess = false
      for (let attempt = 0; attempt < maxRetryAttempts && !retrySuccess; attempt++) {
        setProcessingStatuses((prev) =>
          prev.map((status, idx) =>
            idx === failedIndex
              ? {
                  ...status,
                  status: "retrying",
                  error: `Retry attempt ${attempt + 1}/${maxRetryAttempts}`,
                  retryCount: attempt + 1,
                }
              : status,
          ),
        )

        if (attempt > 0) {
          const delay = getRetryDelay(attempt - 1)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }

        try {
          const result = await processImageFile(failedStatus.originalFile)

          // Validate the extracted marks
          const validationIssues = validateExtractedMarks(result)

          setProcessingStatuses((prev) =>
            prev.map((status, idx) =>
              idx === failedIndex
                ? {
                    ...status,
                    status: "success",
                    data: result,
                    error: undefined,
                    validationIssues,
                  }
                : status,
            ),
          )

          results.push(result)
          retrySuccess = true

          toast({
            title: "Retry Successful",
            description: `Successfully processed ${failedStatus.fileName} on attempt ${attempt + 1}.`,
          })

          // Show validation warnings if any
          if (validationIssues.length > 0) {
            const errorCount = validationIssues.filter((i) => i.severity === "error").length
            const warningCount = validationIssues.filter((i) => i.severity === "warning").length

            toast({
              variant: errorCount > 0 ? "destructive" : "warning",
              title: "Validation Issues Detected",
              description: `${failedStatus.fileName}: ${errorCount} errors, ${warningCount} warnings. Check details for more information.`,
            })
          }
        } catch (error: any) {
          const isLastAttempt = attempt === maxRetryAttempts - 1
          const errorMessage = "Model is unable to extract marks. Please try again.";

          setProcessingStatuses((prev) =>
            prev.map((status, idx) =>
              idx === failedIndex
                ? {
                    ...status,
                    status: isLastAttempt ? "error" : "retrying",
                    error: isLastAttempt ? errorMessage : `Attempt ${attempt + 1} failed. Retrying...`,
                    retryCount: attempt + 1,
                  }
                : status,
            ),
          )

          if (isLastAttempt) {
            toast({
              variant: "destructive",
              title: "Retry Failed",
              description: `Failed to process ${failedStatus.fileName} after ${maxRetryAttempts} attempts.`,
            })
          }
        }
      }
    }

    setIsRetrying(false)
  }

  const retryIndividualFile = async (statusIndex: number) => {
    const status = processingStatuses[statusIndex]
    if (!status.originalFile || status.status === "processing" || status.status === "retrying") return

    setProcessingStatuses((prev) =>
      prev.map((s, idx) =>
        idx === statusIndex
          ? { ...s, status: "retrying", error: "Manual retry in progress...", retryCount: (s.retryCount || 0) + 1 }
          : s,
      ),
    )

    try {
      const result = await processImageFile(status.originalFile)

      // Validate the extracted marks
      const validationIssues = validateExtractedMarks(result)

      setProcessingStatuses((prev) =>
        prev.map((s, idx) =>
          idx === statusIndex
            ? {
                ...s,
                status: "success",
                data: result,
                error: undefined,
                validationIssues,
              }
            : s,
        ),
      )
      
      const newExtractedData = [...extractedData.filter(d => d.originalFileName !== result.originalFileName), result];
      setExtractedData(newExtractedData)
      generateExcelFile(newExtractedData)


      toast({
        title: "Manual Retry Successful",
        description: `Successfully processed ${status.fileName}.`,
      })

      // Show validation warnings if any
      if (validationIssues.length > 0) {
        const errorCount = validationIssues.filter((i) => i.severity === "error").length
        const warningCount = validationIssues.filter((i) => i.severity === "warning").length

        toast({
          variant: errorCount > 0 ? "destructive" : "warning",
          title: "Validation Issues Detected",
          description: `${status.fileName}: ${errorCount} errors, ${warningCount} warnings. Check details for more information.`,
        })
      }
    } catch (error: any) {
      setProcessingStatuses((prev) =>
        prev.map((s, idx) =>
          idx === statusIndex ? { ...s, status: "error", error: "Model is unable to extract marks. Please try again." } : s,
        ),
      )

      toast({
        variant: "destructive",
        title: "Manual Retry Failed",
        description: `Failed to process ${status.fileName}.`,
      })
    }
  }

  const retryAllFailedFiles = async () => {
    const failedIndices = processingStatuses
      .map((status, index) => ({ status, index }))
      .filter(({ status }) => status.status === "error")
      .map(({ index }) => index)

    if (failedIndices.length === 0) return

    setIsRetrying(true)

    for (const index of failedIndices) {
      await retryIndividualFile(index)
    }

    setIsRetrying(false)
  }

  // Calculate group totals (e.g., 6A = sum of 6a(i), 6a(ii), 6a(iii))
  const calculateGroupTotals = (data: ExtractHandwrittenMarksOutput) => {
    const groupTotals: Record<string, number> = {}

    Object.entries(questionGroups).forEach(([groupKey, parts]) => {
      // Skip total groups
      if (groupKey.includes("_Total")) return

      const total = parts.reduce((sum, part) => {
        const mark = data.marks.find((m) => m.questionNumber === part)
        return sum + (mark ? Number.parseInt(mark.mark) || 0 : 0)
      }, 0)

      groupTotals[groupKey] = total
    })

    return groupTotals
  }

  // Calculate CO totals based on mapping
  const calculateCOTotals = (data: ExtractHandwrittenMarksOutput, groupTotals: Record<string, number>) => {
    const coTotals: Record<string, number> = {}

    courseOutcomes.forEach((co) => {
      const total = courseOutcomeMapping[co].reduce((sum, question) => {
        // For single digit questions (1-5)
        if (question.startsWith("Q")) {
          const qNum = question.substring(1) // Extract the number part (e.g., "Q1" -> "1")
          const mark = data.marks.find((m) => m.questionNumber === qNum)
          return sum + (mark ? Number.parseInt(mark.mark) || 0 : 0)
        }
        // For group questions (6A, 7B, etc.)
        else {
          return sum + (groupTotals[question] || 0)
        }
      }, 0)

      coTotals[co] = total
    })

    return coTotals
  }

  const generateExcelData = useCallback(
    (data: ExtractHandwrittenMarksOutput[]) => {
      return data.map((item) => {
        // Calculate group totals
        const groupTotals = calculateGroupTotals(item)

        // Calculate CO totals
        const coTotals = calculateCOTotals(item, groupTotals)

        // Create the row data
        const rowData: Record<string, string | number> = {
          Name: item.name,
          RRN: item.rollNumber,
          Course: item.courseCode,
        }

        // Add single digit questions (1-5)
        for (let i = 1; i <= 5; i++) {
          const qKey = `Q${i}`
          const mark = item.marks.find((m) => m.questionNumber === i.toString())
          rowData[qKey] = mark ? Number.parseInt(mark.mark) || 0 : 0
        }

        // Add group totals (6A, 6B, etc.)
         Object.keys(questionsByMainNumber).forEach(mainNumKey => {
            questionsByMainNumber[mainNumKey].forEach(groupKey => {
                 rowData[groupKey] = groupTotals[groupKey] || 0;
            });
        });

        // Add total marks
        rowData["Total"] = Number.parseInt(item.totalMarks) || 0

        // Add CO totals
        courseOutcomes.forEach((co) => {
          rowData[co] = coTotals[co]
        })
        
        // Ensure all excelColumns are present, defaulting to 0 or empty string if not found
        excelColumns.forEach(col => {
            if (!(col in rowData)) {
                rowData[col] = (typeof rowData[excelColumns[0]] === 'number') ? 0: "";
            }
        });

        return rowData
      })
    },
    [courseOutcomeMapping, courseOutcomes],
  )

  const generateExcelFile = useCallback(
    (data: ExtractHandwrittenMarksOutput[]) => {
      if (data.length === 0) {
         setExcelFileBlob(null); 
         return null;
      }

      const excelData = generateExcelData(data)

      // Create the main worksheet with grouped data
      const worksheet = XLSX.utils.json_to_sheet(excelData, { header: excelColumns }) // Enforce column order
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Summary")

      // Create a second worksheet with raw sub-part marks
      const rawData = data.map((item) => {
        const rowData: Record<string, string | number> = {
          Name: item.name,
          RRN: item.rollNumber,
          Course: item.courseCode,
          Original_Filename: item.originalFileName || ""
        }
        
        allQuestionParts.forEach(part => {
            const mark = item.marks.find((m) => m.questionNumber === part);
            rowData[part] = mark ? Number.parseInt(mark.mark) || 0 : 0;
        });
        rowData["Declared_Total"] = Number.parseInt(item.totalMarks) || 0;
        return rowData
      })

      const rawWorksheet = XLSX.utils.json_to_sheet(rawData)
      XLSX.utils.book_append_sheet(workbook, rawWorksheet, "Raw Marks")

      // Create a third worksheet with CO mapping
      const coMappingData = [
        { "Course Outcome": "Questions" },
        ...courseOutcomes.map((co) => ({
          "Course Outcome": co,
          Questions: courseOutcomeMapping[co].join(", "),
        })),
      ]

      const coWorksheet = XLSX.utils.json_to_sheet(coMappingData)
      XLSX.utils.book_append_sheet(workbook, coWorksheet, "CO Mapping")

      // Format headers
      const formatHeaders = (ws: XLSX.WorkSheet) => {
        const range = XLSX.utils.decode_range(ws["!ref"] || "A1")
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const address = XLSX.utils.encode_col(C) + "1"
          if (!ws[address]) continue
          ws[address].s = { font: { bold: true } }
        }
      }

      formatHeaders(worksheet)
      formatHeaders(rawWorksheet)
      formatHeaders(coWorksheet)

      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      })

      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })

      setExcelFileBlob(blob)
      return blob
    },
    [generateExcelData, courseOutcomeMapping, courseOutcomes],
  )

  const handleDownloadExcel = useCallback(() => {
    if (excelFileBlob) {
      FileSaver.saveAs(excelFileBlob, `cat_3_credits_marksheet_data_${new Date().toISOString().slice(0, 10)}.xlsx`)
      toast({
        title: "Excel Download Started",
        description: "Your Excel file is being downloaded.",
      })
    } else {
      toast({
        variant: "destructive",
        title: "No data to download",
        description: "Please upload and extract data first.",
      })
    }
  }, [excelFileBlob, toast])

  const handleViewImage = (status: ProcessingStatus) => {
    if (status.imageUrl) {
      window.open(status.imageUrl, "_blank")
    }
  }

  const resetForm = () => {
    processingStatuses.forEach((status) => {
      if (status.imageUrl) {
        URL.revokeObjectURL(status.imageUrl)
      }
    })

    setExtractedData([])
    setProcessingStatuses([])
    setProgress(0)
    setExcelFileBlob(null)
    setSelectedFile(null)
    setSelectedFiles(null)
    setIsRetrying(false)
    form.reset()
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const onSubmit = (data: UploadFormValues) => {
    if (data.files) {
        processImages(data.files);
    } else {
        toast({
            variant: "destructive",
            title: "No files selected",
            description: "Please select files to upload.",
        });
    }
  }

  // Add these functions after the existing helper functions
  const scrollToElement = (elementId: string) => {
    const element = document.getElementById(elementId)
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
        inline: "nearest",
      })
    }
  }

  const handleViewDetails = (data: ExtractHandwrittenMarksOutput) => {
    setSelectedFile(data)
    // Scroll to the details section after a short delay to allow state update
    setTimeout(() => scrollToElement("marksheet-details"), 100)
  }

  const handleViewValidationIssues = (status: ProcessingStatus) => {
    setSelectedStatus(status)
    // Scroll to the validation issues section after a short delay
    setTimeout(() => scrollToElement("validation-issues"), 100)
  }

  const fileAccept = uploadMode === "zip" ? "application/zip,image/*" : "image/*"

  const getStatusBadge = (status: ProcessingStatus) => {
    switch (status.status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>
      case "processing":
        return <Badge variant="default">Processing</Badge>
      case "retrying":
        return (
          <Badge variant="outline" className="text-orange-600">
            Retrying ({status.retryCount || 0})
          </Badge>
        )
      case "corrected":
        return (
          <Badge variant="default" className="bg-blue-500">
            Corrected
          </Badge>
        )
      case "success":
        if (status.validationIssues?.some((i) => i.severity === "error")) {
          return <Badge variant="destructive">Validation Errors</Badge>
        }
        if (status.validationIssues?.some((i) => i.severity === "warning")) {
          return (
            <Badge variant="warning" className="bg-yellow-500 text-white">
              Warnings
            </Badge>
          )
        }
        return (
          <Badge variant="default" className="bg-green-500">
            Success
          </Badge>
        )
      case "error":
        return <Badge variant="destructive">Error</Badge>
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  // Toggle a question in a CO mapping
  const toggleQuestionInCO = (co: string, question: string) => {
    setCourseOutcomeMapping((prev) => {
      const newMapping = { ...prev }

      // Remove the question from all COs first (questions are mutually exclusive)
      courseOutcomes.forEach((outcome) => {
        newMapping[outcome] = newMapping[outcome].filter((q) => q !== question)
      })

      // Add to the selected CO
      if (!newMapping[co].includes(question)) {
        newMapping[co] = [...newMapping[co], question]
      }

      return newMapping
    })
  }

  // Add a new CO
  const addCourseOutcome = () => {
    const nextNumber = courseOutcomes.length + 1
    const newCO = `CO${nextNumber}`

    setCourseOutcomes((prev) => [...prev, newCO])
    setCourseOutcomeMapping((prev) => ({
      ...prev,
      [newCO]: [],
    }))
  }

  // Listen for updates from compare tab
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return

      if (event.data.type === "MARKSHEET_DATA_UPDATED") {
        const sessionId = event.data.sessionId
        const storedData = localStorage.getItem(`marksheet-updated-${sessionId}`)

        if (storedData) {
          try {
            const parsedData = JSON.parse(storedData)
            setExtractedData(parsedData.extractedData)
            setProcessingStatuses(parsedData.processingStatuses)
            generateExcelFile(parsedData.extractedData)

            // Clean up
            localStorage.removeItem(`marksheet-updated-${sessionId}`)

            toast({
              title: "Data Updated",
              description: "Changes from the comparison tab have been applied successfully.",
            })
          } catch (error) {
            console.error("Failed to parse updated data:", error)
          }
        }
      }
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [generateExcelFile, toast])

  return (
    <div className="container mx-auto p-4 space-y-6">
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-6 w-6" />
            CAT Marksheet (3 Credits) - Batch Processing
          </CardTitle>
          <CardDescription>
            Upload marksheet images to extract and compile data with automatic retry functionality.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            defaultValue="single"
            onValueChange={(v) => setUploadMode(v as "single" | "multiple" | "zip")}
            className="mb-6"
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="single">Single Image</TabsTrigger>
              <TabsTrigger value="multiple">Multiple Images</TabsTrigger>
              <TabsTrigger value="zip">ZIP Archive</TabsTrigger>
            </TabsList>
            <TabsContent value="single">
              <p className="text-sm text-muted-foreground mb-4">Upload a single marksheet image to extract data.</p>
            </TabsContent>
            <TabsContent value="multiple">
              <p className="text-sm text-muted-foreground mb-4">
                Upload multiple marksheet images to process them in batch.
              </p>
            </TabsContent>
            <TabsContent value="zip">
              <p className="text-sm text-muted-foreground mb-4">
                Upload a ZIP file containing multiple marksheet images.
              </p>
            </TabsContent>
          </Tabs>

          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="files"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Upload {uploadMode === "single" ? "Marksheet" : "Marksheets"}</FormLabel>
                    <FormControl>
                      <div className="space-y-4">
                        <Label
                          htmlFor="upload-files"
                          className={cn(
                            "flex flex-col items-center justify-center h-40 border-2 border-dashed border-input bg-background px-3 py-2 cursor-pointer rounded-md transition-colors",
                            isProcessing ? "cursor-wait" : "hover:bg-accent/50",
                            selectedFiles && selectedFiles.length > 0 ? "border-primary bg-primary/5" : "",
                          )}
                        >
                          {isProcessing ? (
                            <div className="w-full flex flex-col items-center">
                              <Skeleton className="w-3/4 h-6 mb-2 rounded-md" />
                              <Progress value={progress} className="w-3/4 h-2" />
                              <span className="mt-2 text-sm text-muted-foreground">
                                Processing files ({progress}%)...
                              </span>
                              {isRetrying && (
                                <span className="mt-1 text-xs text-orange-600">Auto-retrying failed files...</span>
                              )}
                            </div>
                          ) : (
                            <>
                              {uploadMode === "zip" ? (
                                <FilesIcon
                                  className={cn(
                                    "h-12 w-12 mb-2",
                                    selectedFiles && selectedFiles.length > 0
                                      ? "text-primary"
                                      : "text-muted-foreground",
                                  )}
                                />
                              ) : (
                                <Upload
                                  className={cn(
                                    "h-12 w-12 mb-2",
                                    selectedFiles && selectedFiles.length > 0
                                      ? "text-primary"
                                      : "text-muted-foreground",
                                  )}
                                />
                              )}
                              <span
                                className={cn(
                                  "font-medium",
                                  selectedFiles && selectedFiles.length > 0 ? "text-primary" : "text-muted-foreground",
                                )}
                              >
                                {selectedFiles && selectedFiles.length > 0
                                  ? `${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""} selected`
                                  : uploadMode === "single"
                                    ? "Drop an image file here or click to browse"
                                    : uploadMode === "zip"
                                      ? "Drop a ZIP file containing images here or click to browse"
                                      : "Drop image files here or click to browse"}
                              </span>
                              <span className="text-xs text-muted-foreground mt-1">
                                {uploadMode === "single"
                                  ? "Supports: JPG, PNG, GIF, etc."
                                  : uploadMode === "zip"
                                    ? "Supports: ZIP containing image files"
                                    : "Supports: Multiple JPG, PNG, GIF, etc."}
                              </span>
                            </>
                          )}
                          <Input
                            id="upload-files"
                            ref={fileInputRef}
                            type="file"
                            accept={fileAccept}
                            multiple={uploadMode !== "single"}
                            disabled={isProcessing}
                            onChange={(e) => {
                              const files = e.target.files
                              field.onChange(files)
                              setSelectedFiles(files)
                            }}
                            className="hidden"
                          />
                        </Label>

                        {selectedFiles && selectedFiles.length > 0 && !isProcessing && (
                          <div className="border rounded-md p-3 bg-muted/30">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">Selected Files:</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedFiles(null)
                                  field.onChange(null)
                                  if (fileInputRef.current) {
                                    fileInputRef.current.value = ""
                                  }
                                }}
                                className="h-6 px-2 text-xs"
                              >
                                Clear
                              </Button>
                            </div>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {Array.from(selectedFiles).map((file, index) => (
                                <div
                                  key={index}
                                  className="flex items-center justify-between text-xs bg-background rounded px-2 py-1"
                                >
                                  <span className="truncate flex-1 mr-2">{file.name}</span>
                                  <span className="text-muted-foreground whitespace-nowrap">
                                    {(file.size / 1024 / 1024).toFixed(1)} MB
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormDescription>
                      {uploadMode === "single"
                        ? "Upload the marksheet image to extract data from."
                        : uploadMode === "zip"
                          ? "Upload a ZIP archive containing marksheet images."
                          : "Upload multiple marksheet images to batch process."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center space-x-4 p-4 bg-muted/30 rounded-md">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="auto-retry"
                    checked={autoRetryEnabled}
                    onChange={(e) => setAutoRetryEnabled(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="auto-retry" className="text-sm font-medium">
                    Auto-retry failed files
                  </label>
                </div>
                <div className="text-xs text-muted-foreground">
                  Max attempts: {maxRetryAttempts} | Delay: {retryDelay}ms
                </div>
              </div>

              {/* Course Outcome Mapping UI */}
              <div className="border rounded-md p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Course Outcome (CO) Mapping</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCourseOutcome}
                    className="flex items-center"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add CO
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {courseOutcomes.map((co) => (
                    <div key={co} className="border rounded-md p-3">
                      <h4 className="font-medium mb-2 text-center">{co}</h4>
                      <div className="grid grid-cols-3 gap-2">
                        {/* Single digit questions */}
                        {["Q1", "Q2", "Q3", "Q4", "Q5"].map((qKey) => (
                          <button
                            key={qKey}
                            type="button"
                            className={cn(
                              "border rounded-md p-2 text-center text-sm transition-colors",
                              courseOutcomeMapping[co].includes(qKey)
                                ? "bg-green-500 text-white border-green-600"
                                : "bg-background hover:bg-accent",
                            )}
                            onClick={() => toggleQuestionInCO(co, qKey)}
                          >
                            {qKey.replace("Q", "")}
                          </button>
                        ))}

                        {/* Group questions */}
                        {Object.keys(questionGroups)
                          .filter((key) => !key.includes("_Total") && !key.startsWith("Q")) // Skip Q1-Q5 and total groups
                          .map((group) => (
                            <button
                              key={group}
                              type="button"
                              className={cn(
                                "border rounded-md p-2 text-center text-sm transition-colors",
                                courseOutcomeMapping[co].includes(group)
                                  ? "bg-green-500 text-white border-green-600"
                                  : "bg-background hover:bg-accent",
                              )}
                              onClick={() => toggleQuestionInCO(co, group)}
                            >
                              {group}
                            </button>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground">
                  Select which questions contribute to each Course Outcome. Questions are mutually exclusive across COs.
                </p>
              </div>

              <Button type="submit" disabled={isProcessing || isRetrying || !form.formState.isValid} className="w-full">
                {isProcessing ? (
                  <>
                    <Skeleton className="h-4 w-4 mr-2 rounded-full" />
                    Processing...
                  </>
                ) : isRetrying ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Retrying failed files...
                  </>
                ) : (
                  "Extract Marks"
                )}
              </Button>
            </form>
          </FormProvider>

          {processingStatuses.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Processing Status</h3>
                <div className="flex items-center space-x-2">
                  {processingStatuses.some((s) => s.status === "error") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={retryAllFailedFiles}
                      disabled={isRetrying || isProcessing}
                    >
                      <RefreshCw className={cn("h-4 w-4 mr-2", isRetrying && "animate-spin")} />
                      Retry All Failed
                    </Button>
                  )}
                </div>
              </div>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processingStatuses.map((status, index) => (
                      <TableRow key={index}>
                        <TableCell className="max-w-[200px] truncate font-medium">{status.fileName}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {getStatusBadge(status)}
                            {status.status === "error" && status.error && (
                              <div className="text-xs text-red-500 max-w-[300px] break-words">{status.error}</div>
                            )}
                            {status.validationIssues && status.validationIssues.length > 0 && (
                              <div className="text-xs text-amber-600">
                                {status.validationIssues.length} validation{" "}
                                {status.validationIssues.length === 1 ? "issue" : "issues"} detected
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            {status.imageUrl && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewImage(status)}
                                title="View original image"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                             <Button
                                variant="outline"
                                size="sm"
                                onClick={() => status.data && handleViewDetails(status.data)}
                                disabled={!status.data}
                                title="View Extracted Data"
                              >
                                View Data
                              </Button>
                            {status.validationIssues && status.validationIssues.length > 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewValidationIssues(status)}
                                className="text-amber-600 hover:text-amber-700"
                              >
                                View Issues
                              </Button>
                            )}
                            {status.status === "error" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => retryIndividualFile(index)}
                                disabled={isRetrying || isProcessing}
                                className="text-orange-600 hover:text-orange-700"
                              >
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Retry
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>

        {extractedData.length > 0 && (
          <CardFooter className="flex flex-col space-y-4">
            <div className="flex w-full justify-between items-center">
              <div className="space-y-1">
                <span className="text-sm font-medium">Processed {extractedData.length} file(s) successfully</span>
                {processingStatuses.some((s) => s.status === "error") && (
                  <div className="text-xs text-red-500">
                    {processingStatuses.filter((s) => s.status === "error").length} file(s) failed
                  </div>
                )}
              </div>
              <div className="flex space-x-2">
                <Button onClick={resetForm} variant="outline">
                  Process New Batch
                </Button>
                <Button onClick={handleDownloadExcel} disabled={!excelFileBlob}>
                  <FileDown className="mr-2 h-4 w-4" />
                  Download Excel
                </Button>
                <Button
                  onClick={() => openCompareInNewTab()}
                  variant="outline"
                  className="bg-blue-50 hover:bg-blue-100 border-blue-200"
                  disabled={!processingStatuses.some(s => s.status === 'success')}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Evaluate Errors
                </Button>
              </div>
            </div>
          </CardFooter>
        )}
      </Card>

      {selectedFile && (
        <Card className="w-full max-w-4xl mx-auto" id="marksheet-details">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Marksheet Details (CAT 3-Credits)</CardTitle>
              <CardDescription>
                {selectedFile.originalFileName && (
                  <span className="font-medium text-primary">File: {selectedFile.originalFileName}</span>
                )}
                {selectedFile.originalFileName && " • "}
                {selectedFile.name} - {selectedFile.rollNumber}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedFile(null)}>
              Close
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="grid gap-2">
                  {selectedFile.originalFileName && (
                    <div className="flex justify-between">
                      <span className="font-medium">Image File:</span>
                      <span className="text-primary font-medium">{selectedFile.originalFileName}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="font-medium">Name:</span>
                    <span>{selectedFile.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Course Code:</span>
                    <span>{selectedFile.courseCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Roll Number:</span>
                    <span>{selectedFile.rollNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Total Marks:</span>
                    <span className="font-bold">{selectedFile.totalMarks}</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-medium mb-2">Marks Breakdown</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Question</TableHead>
                      <TableHead className="text-right">Marks</TableHead>
                      <TableHead className="text-right">Max</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Group marks by their question groups */}
                    {Object.entries(questionGroups)
                      .filter(([key]) => !key.includes("_Total"))
                      .map(([group, parts]) => {
                        const hasAnyPart = parts.some((part) =>
                          selectedFile.marks.some((m) => m.questionNumber === part),
                        )

                        if (!hasAnyPart && !parts.some(p => maxMarks[p] !== undefined)) return null;


                        return (
                          <React.Fragment key={group}>
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={3} className="font-medium">
                                {group}
                              </TableCell>
                            </TableRow>
                            {parts.map((part) => {
                              const mark = selectedFile.marks.find((m) => m.questionNumber === part)
                              if (!mark && maxMarks[part] === undefined) return null;


                              const markValue = mark ? Number.parseInt(mark.mark) || 0 : 0
                              const maxAllowed = maxMarks[part] || 0
                              const isOverMax = markValue > maxAllowed

                              return (
                                <TableRow key={part}>
                                  <TableCell className="pl-6">{part}</TableCell>
                                  <TableCell className={cn("text-right", isOverMax && "text-red-600 font-bold")}>
                                    {mark?.mark || "0"}
                                  </TableCell>
                                  <TableCell className="text-right text-muted-foreground">{maxAllowed}</TableCell>
                                </TableRow>
                              )
                            })}
                          </React.Fragment>
                        )
                      })}

                    {/* Show other marks that don't fit into the groups */}
                    {selectedFile.marks
                      .filter((mark) => !allQuestionParts.includes(mark.questionNumber))
                      .map((mark, index) => {
                        const markValue = Number.parseInt(mark.mark) || 0
                        const maxAllowed = maxMarks[mark.questionNumber] || 0
                        const isOverMax = markValue > maxAllowed

                        return (
                          <TableRow key={`other-${index}`}>
                            <TableCell>Question {mark.questionNumber}</TableCell>
                            <TableCell className={cn("text-right", isOverMax && "text-red-600 font-bold")}>
                              {mark.mark}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">{maxAllowed || "N/A"}</TableCell>
                          </TableRow>
                        )
                      })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedStatus && (
        <Card className="w-full max-w-4xl mx-auto" id="validation-issues">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Validation Issues (CAT 3-Credits)</CardTitle>
              <CardDescription>
                <span className="font-medium text-primary">File: {selectedStatus.fileName}</span>
                {" • "}Issues detected during processing
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedStatus(null)}>
              Close
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {selectedStatus.validationIssues?.map((issue, index) => (
                <div
                  key={index}
                  className={cn(
                    "p-3 rounded-md border",
                    issue.severity === "error" ? "border-red-200 bg-red-50" : "border-yellow-200 bg-yellow-50",
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={issue.severity === "error" ? "destructive" : "warning"}>
                      {issue.severity.toUpperCase()}
                    </Badge>
                    <span className="font-medium">{issue.type.replace("_", " ").toUpperCase()}</span>
                  </div>
                  <p className="text-sm text-gray-700">{issue.message}</p>
                </div>
              ))}

              {(!selectedStatus.validationIssues || selectedStatus.validationIssues.length === 0) && (
                <p className="text-sm text-muted-foreground">No validation issues detected.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  )
}
