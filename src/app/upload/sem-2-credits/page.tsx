
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

// Define the question structure for SEM 2-Credits
const questionGroups = {
  Q1: ["1"], Q2: ["2"], Q3: ["3"], Q4: ["4"], Q5: ["5"],
  Q6: ["6"], Q7: ["7"], Q8: ["8"], Q9: ["9"], Q10: ["10"],
  PartA_Total: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],

  "11A": ["11a(i)", "11a(ii)", "11a(iii)"],
  "11B": ["11b(i)", "11b(ii)", "11b(iii)"],
  "11C": ["11c(i)", "11c(ii)", "11c(iii)"],
  Q11_Total: ["11A", "11B", "11C"],

  "12A": ["12a(i)", "12a(ii)", "12a(iii)"],
  "12B": ["12b(i)", "12b(ii)", "12b(iii)"],
  "12C": ["12c(i)", "12c(ii)", "12c(iii)"],
  Q12_Total: ["12A", "12B", "12C"],

  "13A": ["13a(i)", "13a(ii)", "13a(iii)"],
  "13B": ["13b(i)", "13b(ii)", "13b(iii)"],
  "13C": ["13c(i)", "13c(ii)", "13c(iii)"],
  Q13_Total: ["13A", "13B", "13C"],

  "14A": ["14a(i)", "14a(ii)", "14a(iii)"],
  "14B": ["14b(i)", "14b(ii)", "14b(iii)"],
  "14C": ["14c(i)", "14c(ii)", "14c(iii)"],
  Q14_Total: ["14A", "14B", "14C"],
}

// Maximum marks for each question and subpart for SEM 2-Credits
const maxMarks = {
  "1": 2, "2": 2, "3": 2, "4": 2, "5": 2,
  "6": 2, "7": 2, "8": 2, "9": 2, "10": 2,
  PartA_Total: 20,

  "11a(i)": 20, "11a(ii)": 20, "11a(iii)": 20,
  "11b(i)": 20, "11b(ii)": 20, "11b(iii)": 20,
  "11c(i)": 20, "11c(ii)": 20, "11c(iii)": 20,
  Q11_Total: 20,

  "12a(i)": 20, "12a(ii)": 20, "12a(iii)": 20,
  "12b(i)": 20, "12b(ii)": 20, "12b(iii)": 20,
  "12c(i)": 20, "12c(ii)": 20, "12c(iii)": 20,
  Q12_Total: 20,

  "13a(i)": 20, "13a(ii)": 20, "13a(iii)": 20,
  "13b(i)": 20, "13b(ii)": 20, "13b(iii)": 20,
  "13c(i)": 20, "13c(ii)": 20, "13c(iii)": 20,
  Q13_Total: 20,

  "14a(i)": 20, "14a(ii)": 20, "14a(iii)": 20,
  "14b(i)": 20, "14b(ii)": 20, "14b(iii)": 20,
  "14c(i)": 20, "14c(ii)": 20, "14c(iii)": 20,
  Q14_Total: 20,

  Grand_Total: 100,
}

// Group questions by their main number for SEM 2-Credits
const questionsByMainNumber = {
  "11": ["11A", "11B", "11C"],
  "12": ["12A", "12B", "12C"],
  "13": ["13A", "13B", "13C"],
  "14": ["14A", "14B", "14C"],
}

// Flatten the question groups for validation
const allQuestionParts = Object.entries(questionGroups)
  .filter(([key]) => !key.includes("_Total"))
  .flatMap(([_, parts]) => parts)

// Define the Excel column structure for SEM 2-Credits
const excelColumns = [
  "Name", "RRN", "Course",
  "Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8", "Q9", "Q10",
  "11A", "11B", "11C",
  "12A", "12B", "12C",
  "13A", "13B", "13C",
  "14A", "14B", "14C",
  "Total",
  "CO1", "CO2", "CO3",
]

type CourseOutcomeMapping = {
  CO1: string[]
  CO2: string[]
  CO3: string[]
  [key: string]: string[]
}

export default function UploadSem2CreditsPage() {
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
      type: 'sem-2-credits',
      index: statusIndex?.toString() || "0",
      sessionId: sessionId,
    })
    const compareUrl = `/compare?${params.toString()}`
    window.open(compareUrl, "_blank")
  }, [processingStatuses, extractedData]);

  const getRetryDelay = (attempt: number) => {
    return Math.min(retryDelay * Math.pow(2, attempt), 30000)
  }

  const processImageFile = async (
    file: File,
  ): Promise<ExtractHandwrittenMarksOutput & { originalFileName?: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = async () => {
        try {
          const base64String = reader.result as string

          const { scanFile } = await import("@/lib/file-scanner");
          const scanResult = await scanFile(file);
          console.log("[SECURITY SCAN]", file.name, scanResult);
          if (!scanResult.safe) {
            throw new Error(`BLOCKED: ${scanResult.details}`);
          }

          const result = await extractHandwrittenMarks({ photoUrl: base64String })
          const processedResult = processExtractedMarks(result)
          const resultWithFilename = { ...processedResult, originalFileName: file.name }
          resolve(resultWithFilename)
        } catch (error: any) {
          reject(error)
        }
      }
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`))
      reader.readAsDataURL(file)
    })
  }

  const processExtractedMarks = (result: ExtractHandwrittenMarksOutput): ExtractHandwrittenMarksOutput => {
    const marksMap = new Map<string, string>()
    const detectedMainNumbers = new Set<string>()
    const detectedSubGroups = new Map<string, Set<string>>()

    result.marks.forEach((mark) => {
      const cleanQuestionNumber = mark.questionNumber.trim().toLowerCase().replace(/\s+/g, "")
      const match = cleanQuestionNumber.match(/(\d+)([a-c])(?:$$([i-iii]+)$$)?/)
      if (match) {
        const [, mainNum, subGroup] = match
        if (questionsByMainNumber[mainNum]) {
            detectedMainNumbers.add(mainNum)
            if (!detectedSubGroups.has(mainNum)) {
                detectedSubGroups.set(mainNum, new Set())
            }
            detectedSubGroups.get(mainNum)?.add(subGroup)
        }
      }
    })

    result.marks.forEach((mark) => {
      const cleanQuestionNumber = mark.questionNumber.trim().toLowerCase().replace(/\s+/g, "")
      if (allQuestionParts.includes(cleanQuestionNumber)) {
        marksMap.set(cleanQuestionNumber, mark.mark)
      } else {
        const match = cleanQuestionNumber.match(/(\d+)\s*([a-c])\s*([i-iii]+)/)
        if (match) {
          const [, num, letter, roman] = match
          const formattedQuestion = `${num}${letter}(${roman})`
          const markMatch = mark.questionNumber.match(/:\s*(\d+)/)
          const markValue = markMatch ? markMatch[1] : mark.mark
          if (allQuestionParts.includes(formattedQuestion)) {
            marksMap.set(formattedQuestion, markValue)
          }
        }
      }
    })

    detectedMainNumbers.forEach((mainNum) => {
      const subGroups = detectedSubGroups.get(mainNum)
      if (subGroups && subGroups.size > 1) {
        let chosenSubGroup = Array.from(subGroups)[0]
        let maxPartsDetected = 0
        for (const subGroup of subGroups) {
          const pattern = new RegExp(`${mainNum}${subGroup}\$$[i-iii]+\$$`)
          const detectedParts = Array.from(marksMap.keys()).filter((key) => pattern.test(key)).length
          if (detectedParts > maxPartsDetected) {
            maxPartsDetected = detectedParts
            chosenSubGroup = subGroup
          }
        }
        for (const key of Array.from(marksMap.keys())) {
          const subGroupMatch = key.match(new RegExp(`${mainNum}([a-c])\$$[i-iii]+\$$`))
          if (subGroupMatch && subGroupMatch[1] !== chosenSubGroup) {
            marksMap.delete(key)
          }
        }
        console.warn(
          `Detected multiple subgroups for question ${mainNum}. Keeping only ${mainNum}${chosenSubGroup} parts.`,
        )
      }
    })

    Object.entries(questionGroups).forEach(([groupKey, parts]) => {
      if (groupKey.includes("_Total")) return
      const hasAnyPart = parts.some((part) => marksMap.has(part))
      if (hasAnyPart) {
        parts.forEach((part) => {
          if (!marksMap.has(part)) {
            marksMap.set(part, "0")
          }
        })
      }
    })

    const processedMarks = Array.from(marksMap.entries()).map(([questionNumber, mark]) => ({
      questionNumber,
      mark,
    }))
    return { ...result, marks: processedMarks }
  }

  const validateExtractedMarks = (data: ExtractHandwrittenMarksOutput): ValidationIssue[] => {
    const issues: ValidationIssue[] = []
    const marksMap = new Map(data.marks.map((m) => [m.questionNumber, Number.parseInt(m.mark) || 0]))

    const calculateGroupTotal = (groupKey: string): number => {
      if (!questionGroups[groupKey]) return 0
      return questionGroups[groupKey].reduce((sum, part) => sum + (marksMap.get(part) || 0), 0)
    }

    data.marks.forEach((mark) => {
      const markValue = Number.parseInt(mark.mark) || 0
      const maxAllowed = maxMarks[mark.questionNumber]
      if (maxAllowed !== undefined && markValue > maxAllowed) {
        issues.push({
          type: "total_mismatch",
          message: `${mark.questionNumber}: Mark ${markValue} exceeds maximum allowed (${maxAllowed})`,
          severity: "error",
        })
      }
    })

    Object.keys(questionsByMainNumber).forEach((mainNum) => {
        const groups = questionsByMainNumber[mainNum]
        const activeGroups = groups.filter((group) => calculateGroupTotal(group) > 0)
        if (activeGroups.length > 1) {
            issues.push({
            type: "multiple_groups",
            message: `Multiple active groups detected for Q${mainNum}: ${activeGroups.join(", ")}. Only one group should have marks.`,
            severity: "error",
            })
        }
    })
    
    const partATotal = Array.from({ length: 10 }, (_, i) => (i + 1).toString())
        .reduce((sum, q) => sum + (marksMap.get(q) || 0), 0)

    if (partATotal > maxMarks.PartA_Total) {
      issues.push({
        type: "total_mismatch",
        message: `Part A total (${partATotal}) exceeds maximum (${maxMarks.PartA_Total})`,
        severity: "warning",
      })
    }

    let calculatedOverallTotal = partATotal;
    Object.keys(questionsByMainNumber).forEach(mainNumKey => { // Iterate Q11-Q14 for SEM 2-credit
        const mainNumGroups = questionsByMainNumber[mainNumKey];
        const activeGroup = mainNumGroups.find(group => calculateGroupTotal(group) > 0);
        const groupTotal = activeGroup ? calculateGroupTotal(activeGroup) : 0;
        
        const qTotalKey = `Q${mainNumKey}_Total` as keyof typeof maxMarks;
        if (maxMarks[qTotalKey] !== undefined && groupTotal > maxMarks[qTotalKey]) {
             issues.push({
                type: "total_mismatch",
                message: `Q${mainNumKey} total (${groupTotal}) exceeds maximum (${maxMarks[qTotalKey]})`,
                severity: "warning",
            });
        }
        calculatedOverallTotal += groupTotal;
    });

    const declaredTotal = Number.parseInt(data.totalMarks) || 0
    if (Math.abs(calculatedOverallTotal - declaredTotal) > 2) {
      issues.push({
        type: "total_mismatch",
        message: `Calculated total (${calculatedOverallTotal}) doesn't match declared total (${declaredTotal})`,
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
      toast({ variant: "destructive", title: "No valid files", description: "Please upload image files or a ZIP." })
      setIsProcessing(false)
      return
    }
    const initialStatuses: ProcessingStatus[] = []
    let filesToProcess: File[] = []
    if (uploadMode === "zip" && imageFiles.some((file) => file.type === "application/zip")) {
      const zipFile = imageFiles.find((file) => file.type === "application/zip")!
      try {
        const zip = new JSZip()
        const zipContent = await zip.loadAsync(zipFile)
        const extractedFiles: File[] = []
        const zipFilePromises: Promise<void>[] = []
        const imageEntries = Object.keys(zipContent.files).filter(
          (path) => !zipContent.files[path].dir && path.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) && !path.startsWith("__MACOSX/") && !path.startsWith("."),
        )
        if (imageEntries.length === 0) {
          toast({ variant: "destructive", title: "No images found in ZIP", description: "ZIP must contain valid images." })
          setIsProcessing(false)
          return
        }
        zipContent.forEach((relativePath, zipEntry) => {
          if (!zipEntry.dir && relativePath.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) && !relativePath.startsWith("__MACOSX/") && !relativePath.startsWith(".")) {
            const promise = zipEntry.async("blob").then((blob) => {
                const extension = relativePath.split(".").pop()?.toLowerCase()
                const mimeType = extension === "jpg" || extension === "jpeg" ? "image/jpeg" : extension === "png" ? "image/png" : extension === "gif" ? "image/gif" : extension === "bmp" ? "image/bmp" : extension === "webp" ? "image/webp" : "image/jpeg"
                const file = new File([blob], relativePath.split("/").pop() || relativePath, { type: mimeType })
                extractedFiles.push(file)
                const imageUrl = URL.createObjectURL(file)
                initialStatuses.push({ fileName: relativePath.split("/").pop() || relativePath, status: "pending", originalFile: file, imageUrl: imageUrl, retryCount: 0 })
              }).catch((error) => console.error(`Failed to extract ${relativePath}:`, error))
            zipFilePromises.push(promise)
          }
        })
        await Promise.all(zipFilePromises)
        filesToProcess = extractedFiles
        if (filesToProcess.length === 0) {
          toast({ variant: "destructive", title: "ZIP extraction failed", description: "No valid images extracted." })
          setIsProcessing(false)
          return
        }
        toast({ title: "ZIP processed", description: `Extracted ${filesToProcess.length} images.` })
      } catch (error) {
        console.error("ZIP processing error:", error)
        toast({ variant: "destructive", title: "ZIP error", description: "Failed to process ZIP. Ensure valid format." })
        setIsProcessing(false)
        return
      }
    } else {
      const validImageFiles = imageFiles.filter((file) => {
        const isValidImage = file.type.startsWith("image/") && file.size > 0
        if (!isValidImage) toast({ variant: "destructive", title: "Invalid file", description: `${file.name} is not valid.` })
        return isValidImage
      })
      if (validImageFiles.length === 0) {
        toast({ variant: "destructive", title: "No valid images", description: "Please select valid images." })
        setIsProcessing(false)
        return
      }
      filesToProcess = validImageFiles
      validImageFiles.forEach((file) => {
        const imageUrl = URL.createObjectURL(file)
        initialStatuses.push({ fileName: file.name, status: "pending", originalFile: file, imageUrl: imageUrl, retryCount: 0 })
      })
    }
    setProcessingStatuses(initialStatuses)
    await processFilesWithRetry(filesToProcess, initialStatuses)
  }

  const processFilesWithRetry = async (filesToProcess: File[], initialStatuses: ProcessingStatus[]) => {
    const results: ExtractHandwrittenMarksOutput[] = []
    let processed = 0
    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i]
      setProcessingStatuses((prev) => prev.map((status, idx) => (idx === i ? { ...status, status: "processing" } : status)))
      try {
        const result = await processImageFile(file)
        const validationIssues = validateExtractedMarks(result)
        setProcessingStatuses((prev) => prev.map((status, idx) => idx === i ? { ...status, status: "success", data: result, validationIssues } : status ))
        results.push(result)
        if (validationIssues.length > 0) {
          const errorCount = validationIssues.filter((iss) => iss.severity === "error").length
          const warningCount = validationIssues.filter((iss) => iss.severity === "warning").length
          toast({ variant: errorCount > 0 ? "destructive" : "warning", title: "Validation Issues", description: `${file.name}: ${errorCount} errors, ${warningCount} warnings.` })
        }
      } catch (error: any) {
        setProcessingStatuses((prev) => prev.map((status, idx) => idx === i ? { ...status, status: "error", error: "Model is unable to extract marks. Please try again." } : status ))
      }
      processed++
      setProgress(Math.round((processed / filesToProcess.length) * 100))
    }
    if (autoRetryEnabled) await autoRetryFailedFiles(results)
    if (results.length > 0) {
      setExtractedData(results)
      generateExcelFile(results)
      const failedCount = filesToProcess.length - results.length
      toast({ title: "Processing Complete", description: `Processed ${results.length}/${filesToProcess.length} files.${failedCount > 0 ? ` ${failedCount} failed.` : ""}`})
    } else {
      toast({ variant: "destructive", title: "Processing Failed", description: "No marks extracted." })
    }
    setIsProcessing(false)
  }

  const autoRetryFailedFiles = async (results: ExtractHandwrittenMarksOutput[]) => {
    const currentStatuses = [...processingStatuses]
    const failedIndices = currentStatuses.map((status, index) => ({ status, index })).filter(({ status }) => status.status === "error").map(({ index }) => index)
    if (failedIndices.length === 0) return
    setIsRetrying(true)
    toast({ title: "Auto-Retry Started", description: `Retrying ${failedIndices.length} failed files...` })
    for (const failedIndex of failedIndices) {
      const failedStatus = currentStatuses[failedIndex]
      if (!failedStatus.originalFile) continue
      let retrySuccess = false
      for (let attempt = 0; attempt < maxRetryAttempts && !retrySuccess; attempt++) {
        setProcessingStatuses((prev) => prev.map((status, idx) => idx === failedIndex ? { ...status, status: "retrying", error: `Retry ${attempt + 1}/${maxRetryAttempts}`, retryCount: attempt + 1 } : status ))
        if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, getRetryDelay(attempt - 1)))
        try {
          const result = await processImageFile(failedStatus.originalFile)
          const validationIssues = validateExtractedMarks(result)
          setProcessingStatuses((prev) => prev.map((status, idx) => idx === failedIndex ? { ...status, status: "success", data: result, error: undefined, validationIssues } : status ))
          results.push(result)
          retrySuccess = true
          toast({ title: "Retry Successful", description: `${failedStatus.fileName} processed on attempt ${attempt + 1}.` })
          if (validationIssues.length > 0) {
            const errorCount = validationIssues.filter((iss) => iss.severity === "error").length
            const warningCount = validationIssues.filter((iss) => iss.severity === "warning").length
            toast({ variant: errorCount > 0 ? "destructive" : "warning", title: "Validation Issues", description: `${failedStatus.fileName}: ${errorCount} errors, ${warningCount} warnings.` })
          }
        } catch (error: any) {
          const isLastAttempt = attempt === maxRetryAttempts - 1
          const errorMessage = "Model is unable to extract marks. Please try again.";
          setProcessingStatuses((prev) => prev.map((status, idx) => idx === failedIndex ? { ...status, status: isLastAttempt ? "error" : "retrying", error: isLastAttempt ? errorMessage : `Attempt ${attempt + 1} failed. Retrying...`, retryCount: attempt + 1 } : status ))
          if (isLastAttempt) toast({ variant: "destructive", title: "Retry Failed", description: `Failed ${failedStatus.fileName} after ${maxRetryAttempts} attempts.` })
        }
      }
    }
    setIsRetrying(false)
  }

  const retryIndividualFile = async (statusIndex: number) => {
    const status = processingStatuses[statusIndex]
    if (!status.originalFile || status.status === "processing" || status.status === "retrying") return
    setProcessingStatuses((prev) => prev.map((s, idx) => idx === statusIndex ? { ...s, status: "retrying", error: "Manual retry...", retryCount: (s.retryCount || 0) + 1 } : s ))
    try {
      const result = await processImageFile(status.originalFile)
      const validationIssues = validateExtractedMarks(result)
      setProcessingStatuses((prev) => prev.map((s, idx) => idx === statusIndex ? { ...s, status: "success", data: result, error: undefined, validationIssues } : s ))
      const newExtractedData = [...extractedData.filter(d => d.originalFileName !== result.originalFileName), result];
      setExtractedData(newExtractedData)
      generateExcelFile(newExtractedData)
      toast({ title: "Manual Retry Successful", description: `Processed ${status.fileName}.` })
      if (validationIssues.length > 0) {
        const errorCount = validationIssues.filter((iss) => iss.severity === "error").length
        const warningCount = validationIssues.filter((iss) => iss.severity === "warning").length
        toast({ variant: errorCount > 0 ? "destructive" : "warning", title: "Validation Issues", description: `${status.fileName}: ${errorCount} errors, ${warningCount} warnings.` })
      }
    } catch (error: any) {
      setProcessingStatuses((prev) => prev.map((s, idx) => idx === statusIndex ? { ...s, status: "error", error: "Model is unable to extract marks. Please try again." } : s ))
      toast({ variant: "destructive", title: "Manual Retry Failed", description: `Failed to process ${status.fileName}.` })
    }
  }

  const retryAllFailedFiles = async () => {
    const failedIndices = processingStatuses.map((status, index) => ({ status, index })).filter(({ status }) => status.status === "error").map(({ index }) => index)
    if (failedIndices.length === 0) return
    setIsRetrying(true)
    for (const index of failedIndices) await retryIndividualFile(index)
    setIsRetrying(false)
  }

  const calculateGroupTotals = (data: ExtractHandwrittenMarksOutput) => {
    const groupTotals: Record<string, number> = {}
    Object.entries(questionGroups).forEach(([groupKey, parts]) => {
      if (groupKey.includes("_Total")) return
      const total = parts.reduce((sum, part) => {
        const mark = data.marks.find((m) => m.questionNumber === part)
        return sum + (mark ? Number.parseInt(mark.mark) || 0 : 0)
      }, 0)
      groupTotals[groupKey] = total
    })
    return groupTotals
  }

  const calculateCOTotals = (data: ExtractHandwrittenMarksOutput, groupTotals: Record<string, number>) => {
    const coTotals: Record<string, number> = {}
    courseOutcomes.forEach((co) => {
      const total = courseOutcomeMapping[co].reduce((sum, question) => {
        if (question.startsWith("Q") && question.match(/^Q\d+$/) ) {
          const qNum = question.substring(1)
          const mark = data.marks.find((m) => m.questionNumber === qNum)
          return sum + (mark ? Number.parseInt(mark.mark) || 0 : 0)
        } else {
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
        const groupTotals = calculateGroupTotals(item)
        const coTotals = calculateCOTotals(item, groupTotals)
        const rowData: Record<string, string | number> = { Name: item.name, RRN: item.rollNumber, Course: item.courseCode }
        for (let i = 1; i <= 10; i++) { // Q1-Q10 for SEM
          const qKey = `Q${i}`
          const mark = item.marks.find((m) => m.questionNumber === i.toString())
          rowData[qKey] = mark ? Number.parseInt(mark.mark) || 0 : 0
        }
        Object.keys(questionsByMainNumber).forEach(mainNumKey => { // Q11-Q14 groups for SEM 2-credits
            questionsByMainNumber[mainNumKey].forEach(groupKey => {
                 rowData[groupKey] = groupTotals[groupKey] || 0;
            });
        });
        rowData["Total"] = Number.parseInt(item.totalMarks) || 0
        courseOutcomes.forEach((co) => { rowData[co] = coTotals[co] })
        excelColumns.forEach(col => { if (!(col in rowData)) rowData[col] = (typeof rowData[excelColumns[0]] === 'number') ? 0: ""; });
        return rowData
      })
    },
    [courseOutcomeMapping, courseOutcomes],
  )

  const generateExcelFile = useCallback(
    (data: ExtractHandwrittenMarksOutput[]) => {
      if (data.length === 0) { setExcelFileBlob(null); return null; }
      const excelData = generateExcelData(data)
      const worksheet = XLSX.utils.json_to_sheet(excelData, { header: excelColumns })
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Summary")
      const rawData = data.map((item) => {
        const rowData: Record<string, string | number> = { Name: item.name, RRN: item.rollNumber, Course: item.courseCode, Original_Filename: item.originalFileName || "" }
        allQuestionParts.forEach(part => {
            const mark = item.marks.find((m) => m.questionNumber === part);
            rowData[part] = mark ? Number.parseInt(mark.mark) || 0 : 0;
        });
        rowData["Declared_Total"] = Number.parseInt(item.totalMarks) || 0;
        return rowData
      })
      const rawWorksheet = XLSX.utils.json_to_sheet(rawData)
      XLSX.utils.book_append_sheet(workbook, rawWorksheet, "Raw Marks")
      const coMappingData = [ { "Course Outcome": "Questions" }, ...courseOutcomes.map((co) => ({ "Course Outcome": co, Questions: courseOutcomeMapping[co].join(", ") })), ]
      const coWorksheet = XLSX.utils.json_to_sheet(coMappingData)
      XLSX.utils.book_append_sheet(workbook, coWorksheet, "CO Mapping")
      const formatHeaders = (ws: XLSX.WorkSheet) => {
        const range = XLSX.utils.decode_range(ws["!ref"] || "A1")
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const address = XLSX.utils.encode_col(C) + "1"
          if (!ws[address]) continue
          ws[address].s = { font: { bold: true } }
        }
      }
      formatHeaders(worksheet); formatHeaders(rawWorksheet); formatHeaders(coWorksheet);
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
      const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      setExcelFileBlob(blob)
      return blob
    },
    [generateExcelData, courseOutcomeMapping, courseOutcomes],
  )

  const handleDownloadExcel = useCallback(() => {
    if (excelFileBlob) {
      FileSaver.saveAs(excelFileBlob, `sem_2_credits_marksheet_data_${new Date().toISOString().slice(0, 10)}.xlsx`)
      toast({ title: "Excel Download Started", description: "Downloading your Excel file." })
    } else {
      toast({ variant: "destructive", title: "No data to download", description: "Upload and extract data first." })
    }
  }, [excelFileBlob, toast])

  const handleViewImage = (status: ProcessingStatus) => { if (status.imageUrl) window.open(status.imageUrl, "_blank") }

  const resetForm = () => {
    processingStatuses.forEach((status) => { if (status.imageUrl) URL.revokeObjectURL(status.imageUrl) })
    setExtractedData([]); setProcessingStatuses([]); setProgress(0); setExcelFileBlob(null);
    setSelectedFile(null); setSelectedFiles(null); setIsRetrying(false); form.reset();
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const onSubmit = (data: UploadFormValues) => {
    if (data.files) processImages(data.files);
    else toast({ variant: "destructive", title: "No files selected", description: "Please select files." });
  }

  const scrollToElement = (elementId: string) => {
    const element = document.getElementById(elementId)
    if (element) element.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" })
  }

  const handleViewDetails = (data: ExtractHandwrittenMarksOutput) => {
    setSelectedFile(data)
    setTimeout(() => scrollToElement("marksheet-details-sem2"), 100)
  }

  const handleViewValidationIssues = (status: ProcessingStatus) => {
    setSelectedStatus(status)
    setTimeout(() => scrollToElement("validation-issues-sem2"), 100)
  }

  const fileAccept = uploadMode === "zip" ? "application/zip,image/*" : "image/*"

  const getStatusBadge = (status: ProcessingStatus) => {
    switch (status.status) {
      case "pending": return <Badge variant="secondary">Pending</Badge>
      case "processing": return <Badge variant="default">Processing</Badge>
      case "retrying": return <Badge variant="outline" className="text-orange-600">Retrying ({status.retryCount || 0})</Badge>
      case "corrected": return <Badge variant="default" className="bg-blue-500">Corrected</Badge>
      case "success":
        if (status.validationIssues?.some((i) => i.severity === "error")) return <Badge variant="destructive">Validation Errors</Badge>
        if (status.validationIssues?.some((i) => i.severity === "warning")) return <Badge variant="warning" className="bg-yellow-500 text-white">Warnings</Badge>
        return <Badge variant="default" className="bg-green-500">Success</Badge>
      case "error": return <Badge variant="destructive">Error</Badge>
      default: return <Badge variant="secondary">Unknown</Badge>
    }
  }

  const toggleQuestionInCO = (co: string, question: string) => {
    setCourseOutcomeMapping((prev) => {
      const newMapping = { ...prev }
      courseOutcomes.forEach((outcome) => { newMapping[outcome] = newMapping[outcome].filter((q) => q !== question) })
      if (!newMapping[co].includes(question)) newMapping[co] = [...newMapping[co], question]
      return newMapping
    })
  }

  const addCourseOutcome = () => {
    const nextNumber = courseOutcomes.length + 1
    const newCO = `CO${nextNumber}`
    setCourseOutcomes((prev) => [...prev, newCO])
    setCourseOutcomeMapping((prev) => ({ ...prev, [newCO]: [] }))
  }

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
            localStorage.removeItem(`marksheet-updated-${sessionId}`)
            toast({ title: "Data Updated", description: "Changes from compare tab applied." })
          } catch (error) { console.error("Failed to parse updated data:", error) }
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
            SEM Marksheet (2 Credits) - Batch Processing
          </CardTitle>
          <CardDescription>
            Upload 2-credit SEM marksheet images to extract and compile data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="single" onValueChange={(v) => setUploadMode(v as "single" | "multiple" | "zip")} className="mb-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="single">Single Image</TabsTrigger>
              <TabsTrigger value="multiple">Multiple Images</TabsTrigger>
              <TabsTrigger value="zip">ZIP Archive</TabsTrigger>
            </TabsList>
            <TabsContent value="single"><p className="text-sm text-muted-foreground mb-4">Upload a single 2-credit SEM marksheet image.</p></TabsContent>
            <TabsContent value="multiple"><p className="text-sm text-muted-foreground mb-4">Upload multiple 2-credit SEM marksheet images.</p></TabsContent>
            <TabsContent value="zip"><p className="text-sm text-muted-foreground mb-4">Upload a ZIP file containing 2-credit SEM marksheet images.</p></TabsContent>
          </Tabs>

          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField control={form.control} name="files" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Upload {uploadMode === "single" ? "Marksheet" : "Marksheets"}</FormLabel>
                    <FormControl>
                      <div className="space-y-4">
                        <Label htmlFor="upload-files-sem2" className={cn("flex flex-col items-center justify-center h-40 border-2 border-dashed border-input bg-background px-3 py-2 cursor-pointer rounded-md transition-colors", isProcessing ? "cursor-wait" : "hover:bg-accent/50", selectedFiles && selectedFiles.length > 0 ? "border-primary bg-primary/5" : "")}>
                          {isProcessing ? (
                            <div className="w-full flex flex-col items-center">
                              <Skeleton className="w-3/4 h-6 mb-2 rounded-md" />
                              <Progress value={progress} className="w-3/4 h-2" />
                              <span className="mt-2 text-sm text-muted-foreground">Processing files ({progress}%)...</span>
                              {isRetrying && <span className="mt-1 text-xs text-orange-600">Auto-retrying...</span>}
                            </div>
                          ) : (
                            <>
                              {uploadMode === "zip" ? <FilesIcon className={cn("h-12 w-12 mb-2", selectedFiles && selectedFiles.length > 0 ? "text-primary" : "text-muted-foreground")} /> : <Upload className={cn("h-12 w-12 mb-2", selectedFiles && selectedFiles.length > 0 ? "text-primary" : "text-muted-foreground")} />}
                              <span className={cn("font-medium", selectedFiles && selectedFiles.length > 0 ? "text-primary" : "text-muted-foreground")}>
                                {selectedFiles && selectedFiles.length > 0 ? `${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""} selected` : uploadMode === "single" ? "Drop image or click to browse" : uploadMode === "zip" ? "Drop ZIP or click to browse" : "Drop images or click to browse"}
                              </span>
                              <span className="text-xs text-muted-foreground mt-1">
                                {uploadMode === "single" ? "Supports: JPG, PNG, etc." : uploadMode === "zip" ? "Supports: ZIP with images" : "Supports: Multiple JPG, PNG, etc."}
                              </span>
                            </>
                          )}
                          <Input id="upload-files-sem2" ref={fileInputRef} type="file" accept={fileAccept} multiple={uploadMode !== "single"} disabled={isProcessing} onChange={(e) => { const files = e.target.files; field.onChange(files); setSelectedFiles(files); }} className="hidden"/>
                        </Label>
                        {selectedFiles && selectedFiles.length > 0 && !isProcessing && (
                          <div className="border rounded-md p-3 bg-muted/30">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">Selected Files:</span>
                              <Button type="button" variant="ghost" size="sm" onClick={() => { setSelectedFiles(null); field.onChange(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="h-6 px-2 text-xs">Clear</Button>
                            </div>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {Array.from(selectedFiles).map((file, index) => (
                                <div key={index} className="flex items-center justify-between text-xs bg-background rounded px-2 py-1">
                                  <span className="truncate flex-1 mr-2">{file.name}</span>
                                  <span className="text-muted-foreground whitespace-nowrap">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormDescription>
                      {uploadMode === "single" ? "Upload the 2-credit SEM marksheet image." : uploadMode === "zip" ? "Upload a ZIP with 2-credit SEM marksheet images." : "Upload multiple 2-credit SEM marksheet images."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-center space-x-4 p-4 bg-muted/30 rounded-md">
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="auto-retry-sem2" checked={autoRetryEnabled} onChange={(e) => setAutoRetryEnabled(e.target.checked)} className="rounded"/>
                  <label htmlFor="auto-retry-sem2" className="text-sm font-medium">Auto-retry failed files</label>
                </div>
                <div className="text-xs text-muted-foreground">Max attempts: {maxRetryAttempts} | Delay: {retryDelay}ms</div>
              </div>
              <div className="border rounded-md p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Course Outcome (CO) Mapping</h3>
                  <Button type="button" variant="outline" size="sm" onClick={addCourseOutcome} className="flex items-center"><Plus className="h-4 w-4 mr-1" />Add CO</Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {courseOutcomes.map((co) => (
                    <div key={co} className="border rounded-md p-3">
                      <h4 className="font-medium mb-2 text-center">{co}</h4>
                      <div className="grid grid-cols-5 gap-2"> 
                        {Array.from({ length: 10 }, (_, i) => `Q${i + 1}`).map((qKey) => (
                          <button key={qKey} type="button" className={cn("border rounded-md p-2 text-center text-sm transition-colors", courseOutcomeMapping[co].includes(qKey) ? "bg-green-500 text-white border-green-600" : "bg-background hover:bg-accent")} onClick={() => toggleQuestionInCO(co, qKey)}>{qKey.replace("Q", "")}</button>
                        ))}
                        {Object.keys(questionGroups).filter((key) => !key.includes("_Total") && !key.match(/^Q\d+$/)).map((group) => ( 
                          <button key={group} type="button" className={cn("border rounded-md p-2 text-center text-sm transition-colors col-span-1", courseOutcomeMapping[co].includes(group) ? "bg-green-500 text-white border-green-600" : "bg-background hover:bg-accent")} onClick={() => toggleQuestionInCO(co, group)}>{group}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Select questions for each CO. Questions are mutually exclusive.</p>
              </div>
              <Button type="submit" disabled={isProcessing || isRetrying || !form.formState.isValid} className="w-full">
                {isProcessing ? <><Skeleton className="h-4 w-4 mr-2 rounded-full" />Processing...</> : isRetrying ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Retrying...</> : "Extract Marks"}
              </Button>
            </form>
          </FormProvider>

          {processingStatuses.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Processing Status</h3>
                {processingStatuses.some((s) => s.status === "error") && <Button variant="outline" size="sm" onClick={retryAllFailedFiles} disabled={isRetrying || isProcessing}><RefreshCw className={cn("h-4 w-4 mr-2", isRetrying && "animate-spin")} />Retry All Failed</Button>}
              </div>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader><TableRow><TableHead>File Name</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {processingStatuses.map((status, index) => (
                      <TableRow key={index}>
                        <TableCell className="max-w-[200px] truncate font-medium">{status.fileName}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {getStatusBadge(status)}
                            {status.status === "error" && status.error && <div className="text-xs text-red-500 max-w-[300px] break-words">{status.error}</div>}
                            {status.validationIssues && status.validationIssues.length > 0 && <div className="text-xs text-amber-600">{status.validationIssues.length} validation {status.validationIssues.length === 1 ? "issue" : "issues"}</div>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            {status.imageUrl && <Button variant="outline" size="sm" onClick={() => handleViewImage(status)} title="View original image"><Eye className="h-4 w-4" /></Button>}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => status.data && handleViewDetails(status.data)}
                                disabled={!status.data}
                                title="View Extracted Data"
                              >
                                View Data
                              </Button>
                            {status.validationIssues && status.validationIssues.length > 0 && <Button variant="outline" size="sm" onClick={() => handleViewValidationIssues(status)} className="text-amber-600 hover:text-amber-700">View Issues</Button>}
                            {status.status === "error" && <Button variant="outline" size="sm" onClick={() => retryIndividualFile(index)} disabled={isRetrying || isProcessing} className="text-orange-600 hover:text-orange-700"><RefreshCw className="h-4 w-4 mr-1" />Retry</Button>}
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
                {processingStatuses.some((s) => s.status === "error") && <div className="text-xs text-red-500">{processingStatuses.filter((s) => s.status === "error").length} file(s) failed</div>}
              </div>
              <div className="flex space-x-2">
                <Button onClick={resetForm} variant="outline">Process New Batch</Button>
                <Button onClick={handleDownloadExcel} disabled={!excelFileBlob}><FileDown className="mr-2 h-4 w-4" />Download Excel</Button>
                <Button onClick={() => openCompareInNewTab()} variant="outline" className="bg-blue-50 hover:bg-blue-100 border-blue-200" disabled={!processingStatuses.some(s => s.status === 'success')}><AlertTriangle className="h-4 w-4 mr-2" />Evaluate Errors</Button>
              </div>
            </div>
          </CardFooter>
        )}
      </Card>

      {selectedFile && (
        <Card className="w-full max-w-4xl mx-auto" id="marksheet-details-sem2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Marksheet Details (SEM 2-Credits)</CardTitle>
              <CardDescription>{selectedFile.originalFileName && <span className="font-medium text-primary">File: {selectedFile.originalFileName}</span>}{selectedFile.originalFileName && " • "}{selectedFile.name} - {selectedFile.rollNumber}</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedFile(null)}>Close</Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="grid gap-2">
                  {selectedFile.originalFileName && <div className="flex justify-between"><span className="font-medium">Image File:</span><span className="text-primary font-medium">{selectedFile.originalFileName}</span></div>}
                  <div className="flex justify-between"><span className="font-medium">Name:</span><span>{selectedFile.name}</span></div>
                  <div className="flex justify-between"><span className="font-medium">Course Code:</span><span>{selectedFile.courseCode}</span></div>
                  <div className="flex justify-between"><span className="font-medium">Roll Number:</span><span>{selectedFile.rollNumber}</span></div>
                  <div className="flex justify-between"><span className="font-medium">Total Marks:</span><span className="font-bold">{selectedFile.totalMarks}</span></div>
                </div>
              </div>
              <div>
                <h3 className="font-medium mb-2">Marks Breakdown</h3>
                <Table>
                  <TableHeader><TableRow><TableHead>Question</TableHead><TableHead className="text-right">Marks</TableHead><TableHead className="text-right">Max</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {Object.entries(questionGroups).filter(([key]) => !key.includes("_Total")).map(([group, parts]) => {
                        const hasAnyPart = parts.some((part) => selectedFile.marks.some((m) => m.questionNumber === part))
                        if (!hasAnyPart && !parts.some(p => maxMarks[p] !== undefined)) return null;
                        return (
                          <React.Fragment key={group}>
                            <TableRow className="bg-muted/30"><TableCell colSpan={3} className="font-medium">{group}</TableCell></TableRow>
                            {parts.map((part) => {
                              const mark = selectedFile.marks.find((m) => m.questionNumber === part)
                              if (!mark && maxMarks[part] === undefined) return null;
                              const markValue = mark ? Number.parseInt(mark.mark) || 0 : 0
                              const maxAllowed = maxMarks[part] || 0
                              const isOverMax = markValue > maxAllowed
                              return (
                                <TableRow key={part}>
                                  <TableCell className="pl-6">{part}</TableCell>
                                  <TableCell className={cn("text-right", isOverMax && "text-red-600 font-bold")}>{mark?.mark || "0"}</TableCell>
                                  <TableCell className="text-right text-muted-foreground">{maxAllowed}</TableCell>
                                </TableRow>
                              )
                            })}
                          </React.Fragment>
                        )
                      })}
                    {selectedFile.marks.filter((mark) => !allQuestionParts.includes(mark.questionNumber)).map((mark, index) => {
                        const markValue = Number.parseInt(mark.mark) || 0
                        const maxAllowed = maxMarks[mark.questionNumber] || 0
                        const isOverMax = markValue > maxAllowed
                        return (
                          <TableRow key={`other-${index}`}><TableCell>Question {mark.questionNumber}</TableCell><TableCell className={cn("text-right", isOverMax && "text-red-600 font-bold")}>{mark.mark}</TableCell><TableCell className="text-right text-muted-foreground">{maxAllowed || "N/A"}</TableCell></TableRow>
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
        <Card className="w-full max-w-4xl mx-auto" id="validation-issues-sem2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Validation Issues (SEM 2-Credits)</CardTitle>
              <CardDescription><span className="font-medium text-primary">File: {selectedStatus.fileName}</span>{" • "}Issues detected</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedStatus(null)}>Close</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {selectedStatus.validationIssues?.map((issue, index) => (
                <div key={index} className={cn("p-3 rounded-md border", issue.severity === "error" ? "border-red-200 bg-red-50" : "border-yellow-200 bg-yellow-50")}>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={issue.severity === "error" ? "destructive" : "warning"}>{issue.severity.toUpperCase()}</Badge>
                    <span className="font-medium">{issue.type.replace("_", " ").toUpperCase()}</span>
                  </div>
                  <p className="text-sm text-gray-700">{issue.message}</p>
                </div>
              ))}
              {(!selectedStatus.validationIssues || selectedStatus.validationIssues.length === 0) && <p className="text-sm text-muted-foreground">No validation issues detected.</p>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
