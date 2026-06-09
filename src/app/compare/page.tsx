
"use client"

import type { ExtractHandwrittenMarksOutput } from "@/ai/flows/extract-handwritten-marks"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import {
  MarksheetConfig,
  MarksheetType,
  getMarksheetConfig,
} from "@/lib/marksheet-config"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  RotateCw,
  Save,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

// Define types in one place
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

// Reusable Input Component for the table
const MarkInput: React.FC<{
  qNum: string
  prefix: string
  mark: string | number
  maxAllowed: number
  onMarkChange: (qNum: string, newMark: string) => void
  className?: string
}> = ({ qNum, prefix, mark, maxAllowed, onMarkChange, className }) => {
  const isOverMax = Number(mark) > maxAllowed
  return (
    <div className="flex items-center justify-start gap-1">
      <span className="text-gray-500 min-w-[50px] text-right pr-1">{prefix}</span>
      <Input
        type="number"
        min="0"
        max={maxAllowed}
        value={mark}
        onChange={(e) => onMarkChange(qNum, e.target.value)}
        className={cn(
          "w-16 h-8 text-center text-sm",
          isOverMax && "border-red-500 bg-red-50 text-red-900",
          className,
        )}
      />
    </div>
  )
}

// #region Marksheet Table Components
const Cat3CreditsTable: React.FC<{
  editedData: ExtractHandwrittenMarksOutput
  onMarkChange: (questionNumber: string, newMark: string) => void
  maxMarks: MarksheetConfig["maxMarks"]
}> = ({ editedData, onMarkChange, maxMarks }) => {
  const getMark = (qNum: string) =>
    editedData.marks.find((m) => m.questionNumber === qNum)?.mark || ""
  const calculateTotal = (qNums: string[]) =>
    qNums.reduce((sum, qNum) => sum + (Number.parseInt(getMark(qNum)) || 0), 0)

  const partATotal = calculateTotal(["1", "2", "3", "4", "5"])
  const partB6Total = calculateTotal(
    maxMarks["6b(i)"] !== undefined
      ? ["6a(i)", "6a(ii)", "6a(iii)", "6b(i)", "6b(ii)", "6b(iii)"]
      : ["6a(i)", "6a(ii)", "6a(iii)"],
  )
  const partB7Total = calculateTotal(
    maxMarks["7b(i)"] !== undefined
      ? ["7a(i)", "7a(ii)", "7a(iii)", "7b(i)", "7b(ii)", "7b(iii)"]
      : ["7a(i)", "7a(ii)", "7a(iii)"],
  )
  const partCTotal = calculateTotal(
    maxMarks["8b(i)"] !== undefined
      ? ["8a(i)", "8a(ii)", "8a(iii)", "8b(i)", "8b(ii)", "8b(iii)"]
      : ["8a(i)", "8a(ii)", "8a(iii)"],
  )

  return (
    <table className="w-full border-collapse border-2 border-gray-600">
      <thead>
        <tr>
          <th className="border-2 border-gray-600 p-3 bg-gray-100 font-bold">
            PART
          </th>
          <th
            colSpan={3}
            className="border-2 border-gray-600 p-3 bg-gray-100 font-bold text-red-600"
          >
            MARKS
          </th>
          <th className="border-2 border-gray-600 p-3 bg-gray-100 font-bold">
            TOTAL
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td
            rowSpan={2}
            className="border-2 border-gray-600 p-3 text-center font-bold bg-gray-50 align-middle"
          >
            A
          </td>
          {[1, 2, 3].map((n) => (
            <td key={n} className="border-2 border-gray-600 p-2">
              <MarkInput
                qNum={`${n}`}
                prefix={`${n})`}
                mark={getMark(`${n}`)}
                maxAllowed={maxMarks[`${n}`] || 0}
                onMarkChange={onMarkChange}
              />
            </td>
          ))}
          <td
            rowSpan={2}
            className="border-2 border-gray-600 p-3 text-center bg-gray-50 align-middle"
          >
            <Input
              type="number"
              readOnly
              value={partATotal}
              className="w-16 text-center border rounded bg-gray-100"
            />
          </td>
        </tr>
        <tr>
          {[4, 5].map((n) => (
            <td key={n} className="border-2 border-gray-600 p-2">
              <MarkInput
                qNum={`${n}`}
                prefix={`${n})`}
                mark={getMark(`${n}`)}
                maxAllowed={maxMarks[`${n}`] || 0}
                onMarkChange={onMarkChange}
              />
            </td>
          ))}
          <td className="border-2 border-gray-600 p-2">
             <MarkInput
                qNum={`6`}
                prefix={`6)`}
                mark={getMark(`6`)}
                maxAllowed={maxMarks[`6`] || 0}
                onMarkChange={onMarkChange}
              />
          </td>
        </tr>
        <tr>
          <td
            rowSpan={4}
            className="border-2 border-gray-600 p-3 text-center font-bold bg-gray-50 align-middle"
          >
            B
          </td>
          {["i", "ii", "iii"].map((p) => (
            <td key={`6a${p}`} className="border-2 border-gray-600 p-2">
              <MarkInput
                qNum={`6a(${p})`}
                prefix={`6a(${p})`}
                mark={getMark(`6a(${p})`)}
                maxAllowed={maxMarks[`6a(${p})`] || 0}
                onMarkChange={onMarkChange}
              />
            </td>
          ))}
          <td
            rowSpan={2}
            className="border-2 border-gray-600 p-3 text-center bg-gray-50 align-middle"
          >
            <Input
              type="number"
              readOnly
              value={partB6Total}
              className="w-16 text-center border rounded bg-gray-100"
            />
          </td>
        </tr>
        <tr>
          {["i", "ii", "iii"].map((p) => (
            <td key={`6b${p}`} className="border-2 border-gray-600 p-2">
              <MarkInput
                qNum={`6b(${p})`}
                prefix={`6b(${p})`}
                mark={getMark(`6b(${p})`)}
                maxAllowed={maxMarks[`6b(${p})`] || 0}
                onMarkChange={onMarkChange}
              />
            </td>
          ))}
        </tr>
        <tr className="border-t-2 border-t-black">
          {["i", "ii", "iii"].map((p) => (
            <td key={`7a${p}`} className="border-2 border-gray-600 p-2">
              <MarkInput
                qNum={`7a(${p})`}
                prefix={`7a(${p})`}
                mark={getMark(`7a(${p})`)}
                maxAllowed={maxMarks[`7a(${p})`] || 0}
                onMarkChange={onMarkChange}
              />
            </td>
          ))}
          <td
            rowSpan={2}
            className="border-2 border-gray-600 p-3 text-center bg-gray-50 align-middle"
          >
            <Input
              type="number"
              readOnly
              value={partB7Total}
              className="w-16 text-center border rounded bg-gray-100"
            />
          </td>
        </tr>
        <tr>
          {["i", "ii", "iii"].map((p) => (
            <td key={`7b${p}`} className="border-2 border-gray-600 p-2">
              <MarkInput
                qNum={`7b(${p})`}
                prefix={`7b(${p})`}
                mark={getMark(`7b(${p})`)}
                maxAllowed={maxMarks[`7b(${p})`] || 0}
                onMarkChange={onMarkChange}
              />
            </td>
          ))}
        </tr>
        <tr>
          <td
            rowSpan={2}
            className="border-2 border-gray-600 p-3 text-center font-bold bg-gray-50 align-middle"
          >
            C
          </td>
          {["i", "ii", "iii"].map((p) => (
            <td key={`8a${p}`} className="border-2 border-gray-600 p-2">
              <MarkInput
                qNum={`8a(${p})`}
                prefix={`8a(${p})`}
                mark={getMark(`8a(${p})`)}
                maxAllowed={maxMarks[`8a(${p})`] || 0}
                onMarkChange={onMarkChange}
              />
            </td>
          ))}
          <td
            rowSpan={2}
            className="border-2 border-gray-600 p-3 text-center bg-gray-50 align-middle"
          >
            <Input
              type="number"
              readOnly
              value={partCTotal}
              className="w-16 text-center border rounded bg-gray-100"
            />
          </td>
        </tr>
        <tr>
          {["i", "ii", "iii"].map((p) => (
            <td key={`8b${p}`} className="border-2 border-gray-600 p-2">
              <MarkInput
                qNum={`8b(${p})`}
                prefix={`8b(${p})`}
                mark={getMark(`8b(${p})`)}
                maxAllowed={maxMarks[`8b(${p})`] || 0}
                onMarkChange={onMarkChange}
              />
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  )
}

const Cat2CreditsTable: React.FC<{
  editedData: ExtractHandwrittenMarksOutput
  onMarkChange: (questionNumber: string, newMark: string) => void
  maxMarks: MarksheetConfig["maxMarks"]
}> = ({ editedData, onMarkChange, maxMarks }) => {
  const getMark = (qNum: string) =>
    editedData.marks.find((m) => m.questionNumber === qNum)?.mark || ""
  const calculateTotal = (qNums: string[]) =>
    qNums.reduce((sum, qNum) => sum + (Number.parseInt(getMark(qNum)) || 0), 0)

  const partATotal = calculateTotal(["1", "2", "3", "4", "5", "6"])
  const partB6Total = calculateTotal(["6a(i)", "6a(ii)", "6a(iii)", "6b(i)", "6b(ii)", "6b(iii)"])
  const partB7Total = calculateTotal(["7a(i)", "7a(ii)", "7a(iii)", "7b(i)", "7b(ii)", "7b(iii)"])

  return (
    <table className="w-full border-collapse border-2 border-gray-600">
      <thead>
        <tr>
          <th className="border-2 border-gray-600 p-3 bg-gray-100 font-bold">
            PART
          </th>
          <th
            colSpan={3}
            className="border-2 border-gray-600 p-3 bg-gray-100 font-bold text-red-600"
          >
            MARKS
          </th>
          <th className="border-2 border-gray-600 p-3 bg-gray-100 font-bold">
            TOTAL
          </th>
        </tr>
      </thead>
      <tbody>
        {/* Part A */}
        <tr>
          <td
            rowSpan={2}
            className="border-2 border-gray-600 p-3 text-center font-bold bg-gray-50 align-middle"
          >
            A
          </td>
          {[1, 2, 3].map((n) => (
            <td key={n} className="border-2 border-gray-600 p-2">
              <MarkInput
                qNum={`${n}`}
                prefix={`${n})`}
                mark={getMark(`${n}`)}
                maxAllowed={maxMarks[`${n}`] || 0}
                onMarkChange={onMarkChange}
              />
            </td>
          ))}
          <td
            rowSpan={2}
            className="border-2 border-gray-600 p-3 text-center bg-gray-50 align-middle"
          >
            <Input
              type="number"
              readOnly
              value={partATotal}
              className="w-16 text-center border rounded bg-gray-100"
            />
          </td>
        </tr>
        <tr>
          {[4, 5, 6].map((n) => (
            <td key={n} className="border-2 border-gray-600 p-2">
              <MarkInput
                qNum={`${n}`}
                prefix={`${n})`}
                mark={getMark(`${n}`)}
                maxAllowed={maxMarks[`${n}`] || 0}
                onMarkChange={onMarkChange}
              />
            </td>
          ))}
        </tr>
        {/* Part B */}
        <tr>
          <td
            rowSpan={4}
            className="border-2 border-gray-600 p-3 text-center font-bold bg-gray-50 align-middle"
          >
            B
          </td>
          {["i", "ii", "iii"].map((p) => (
            <td key={`6a${p}`} className="border-2 border-gray-600 p-2">
              <MarkInput
                qNum={`6a(${p})`}
                prefix={`6a(${p})`}
                mark={getMark(`6a(${p})`)}
                maxAllowed={maxMarks[`6a(${p})`] || 0}
                onMarkChange={onMarkChange}
              />
            </td>
          ))}
          <td
            rowSpan={2}
            className="border-2 border-gray-600 p-3 text-center bg-gray-50 align-middle"
          >
            <Input
              type="number"
              readOnly
              value={partB6Total}
              className="w-16 text-center border rounded bg-gray-100"
              placeholder="20"
            />
          </td>
        </tr>
        <tr>
          {["i", "ii", "iii"].map((p) => (
            <td key={`6b${p}`} className="border-2 border-gray-600 p-2">
              <MarkInput
                qNum={`6b(${p})`}
                prefix={`6b(${p})`}
                mark={getMark(`6b(${p})`)}
                maxAllowed={maxMarks[`6b(${p})`] || 0}
                onMarkChange={onMarkChange}
              />
            </td>
          ))}
        </tr>
        <tr className="border-t-2 border-t-black">
          {["i", "ii", "iii"].map((p) => (
            <td key={`7a${p}`} className="border-2 border-gray-600 p-2">
              <MarkInput
                qNum={`7a(${p})`}
                prefix={`7a(${p})`}
                mark={getMark(`7a(${p})`)}
                maxAllowed={maxMarks[`7a(${p})`] || 0}
                onMarkChange={onMarkChange}
              />
            </td>
          ))}
          <td
            rowSpan={2}
            className="border-2 border-gray-600 p-3 text-center bg-gray-50 align-middle"
          >
            <Input
              type="number"
              readOnly
              value={partB7Total}
              className="w-16 text-center border rounded bg-gray-100"
              placeholder="20"
            />
          </td>
        </tr>
        <tr>
          {["i", "ii", "iii"].map((p) => (
            <td key={`7b${p}`} className="border-2 border-gray-600 p-2">
              <MarkInput
                qNum={`7b(${p})`}
                prefix={`7b(${p})`}
                mark={getMark(`7b(${p})`)}
                maxAllowed={maxMarks[`7b(${p})`] || 0}
                onMarkChange={onMarkChange}
              />
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  )
}

const SemCreditsTable: React.FC<{
  editedData: ExtractHandwrittenMarksOutput
  onMarkChange: (questionNumber: string, newMark: string) => void
  maxMarks: MarksheetConfig["maxMarks"]
  config: MarksheetConfig
}> = ({ editedData, onMarkChange, maxMarks, config }) => {
  const getMark = (qNum: string) =>
    editedData.marks.find((m) => m.questionNumber === qNum)?.mark || ""
  const calculateTotal = (qNums: string[]) =>
    qNums.reduce((sum, qNum) => sum + (Number.parseInt(getMark(qNum)) || 0), 0)

  const partATotal = calculateTotal(config.structure.partA)
  const partBTotals = config.structure.partB.map((part) => {
    const questionSubParts = (option: string) => ["i", "ii", "iii"].map(p => `${part.question}${option}(${p})`);
    return {
        question: part.question,
        totalA: calculateTotal(questionSubParts('a')),
        totalB: calculateTotal(questionSubParts('b')),
    };
  });

  const partCQuestion = config.structure.partC?.[0];
  const partCTotal = partCQuestion
    ? calculateTotal(
        ["i", "ii", "iii"]
            .map(p => `${partCQuestion.question}a(${p})`)
            .concat(["i", "ii", "iii"].map(p => `${partCQuestion.question}b(${p})`))
      )
    : 0;

  return (
    <table className="w-full border-collapse border-2 border-gray-600">
      <thead>
        <tr>
          <th className="border-2 border-gray-600 p-3 bg-gray-100 font-bold">
            PART
          </th>
          <th
            colSpan={3}
            className="border-2 border-gray-600 p-3 bg-gray-100 font-bold text-red-600"
          >
            MARKS
          </th>
          <th className="border-2 border-gray-600 p-3 bg-gray-100 font-bold">
            TOTAL
          </th>
        </tr>
      </thead>
      <tbody>
        {/* Part A */}
        <tr>
          <td
            rowSpan={4}
            className="border-2 border-gray-600 p-3 text-center font-bold bg-gray-50 align-middle"
          >
            A
          </td>
          {[1, 2, 3].map((n) => (
            <td key={n} className="border-2 border-gray-600 p-2">
              <MarkInput
                qNum={`${n}`}
                prefix={`${n})`}
                mark={getMark(`${n}`)}
                maxAllowed={maxMarks[`${n}`] || 0}
                onMarkChange={onMarkChange}
              />
            </td>
          ))}
          <td
            rowSpan={4}
            className="border-2 border-gray-600 p-3 text-center bg-gray-50 align-middle"
          >
            <Input
              type="number"
              readOnly
              value={partATotal}
              className="w-16 text-center border rounded bg-gray-100"
              placeholder="20"
            />
          </td>
        </tr>
        <tr>
          {[4, 5, 6].map((n) => (
            <td key={n} className="border-2 border-gray-600 p-2">
              <MarkInput
                qNum={`${n}`}
                prefix={`${n})`}
                mark={getMark(`${n}`)}
                maxAllowed={maxMarks[`${n}`] || 0}
                onMarkChange={onMarkChange}
              />
            </td>
          ))}
        </tr>
        <tr>
          {[7, 8, 9].map((n) => (
            <td key={n} className="border-2 border-gray-600 p-2">
              <MarkInput
                qNum={`${n}`}
                prefix={`${n})`}
                mark={getMark(`${n}`)}
                maxAllowed={maxMarks[`${n}`] || 0}
                onMarkChange={onMarkChange}
              />
            </td>
          ))}
        </tr>
        <tr>
          <td className="border-2 border-gray-600 p-2">
            <MarkInput
              qNum="10"
              prefix="10)"
              mark={getMark("10")}
              maxAllowed={maxMarks["10"] || 0}
              onMarkChange={onMarkChange}
            />
          </td>
          <td className="border-2 border-gray-600 p-2"></td>
          <td className="border-2 border-gray-600 p-2"></td>
        </tr>
        {/* Part B */}
        {partBTotals.map((part, idx) => (
          <React.Fragment key={part.question}>
            <tr className={idx > 0 ? "border-t-2 border-t-black" : ""}>
              {idx === 0 && (
                <td
                  rowSpan={partBTotals.length * 2}
                  className="border-2 border-gray-600 p-3 text-center font-bold bg-gray-50 align-middle"
                >
                  B
                </td>
              )}
              {["i", "ii", "iii"].map((p, i) => (
                <td
                  key={`${part.question}a${p}`}
                  className="border-2 border-gray-600 p-2"
                >
                  <MarkInput
                    qNum={`${part.question}a(${p})`}
                    prefix={`${part.question}a(${p})`}
                    mark={getMark(`${part.question}a(${p})`)}
                    maxAllowed={
                      maxMarks[`${part.question}a(${p})`] || 0
                    }
                    onMarkChange={onMarkChange}
                  />
                </td>
              ))}
              <td
                rowSpan={2}
                className="border-2 border-gray-600 p-3 text-center bg-gray-50 align-middle"
              >
                <Input
                  type="number"
                  readOnly
                  value={part.totalA + part.totalB}
                  className="w-16 text-center border rounded bg-gray-100"
                  placeholder={config.type === 'sem-2-credits' ? "20" : "16"}
                />
              </td>
            </tr>
            <tr>
              {["i", "ii", "iii"].map((p, i) => (
                <td
                  key={`${part.question}b${p}`}
                  className="border-2 border-gray-600 p-2"
                >
                  <MarkInput
                    qNum={`${part.question}b(${p})`}
                    prefix={`${part.question}b(${p})`}
                    mark={getMark(`${part.question}b(${p})`)}
                    maxAllowed={
                      maxMarks[`${part.question}b(${p})`] || 0
                    }
                    onMarkChange={onMarkChange}
                  />
                </td>
              ))}
            </tr>
          </React.Fragment>
        ))}
        {/* Part C */}
        {config.structure.partC && (
          <>
            <tr className="border-t-2 border-t-black">
              <td
                rowSpan={2}
                className="border-2 border-gray-600 p-3 text-center font-bold bg-gray-50 align-middle"
              >
                C
              </td>
              {["i", "ii", "iii"].map((p) => (
                <td key={`15a${p}`} className="border-2 border-gray-600 p-2">
                  <MarkInput
                    qNum={`15a(${p})`}
                    prefix={`15a(${p})`}
                    mark={getMark(`15a(${p})`)}
                    maxAllowed={maxMarks[`15a(${p})`] || 0}
                    onMarkChange={onMarkChange}
                  />
                </td>
              ))}
              <td
                rowSpan={2}
                className="border-2 border-gray-600 p-3 text-center bg-gray-50 align-middle"
              >
                <Input
                  type="number"
                  readOnly
                  value={partCTotal}
                  className="w-16 text-center border rounded bg-gray-100"
                  placeholder="16"
                />
              </td>
            </tr>
            <tr>
              {["i", "ii", "iii"].map((p) => (
                <td key={`15b${p}`} className="border-2 border-gray-600 p-2">
                  <MarkInput
                    qNum={`15b(${p})`}
                    prefix={`15b(${p})`}
                    mark={getMark(`15b(${p})`)}
                    maxAllowed={maxMarks[`15b(${p})`] || 0}
                    onMarkChange={onMarkChange}
                  />
                </td>
              ))}
            </tr>
          </>
        )}
      </tbody>
    </table>
  )
}
// #endregion

// Main component logic
function ComparePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [marksheetType, setMarksheetType] = useState<MarksheetType | null>(null)
  const [config, setConfig] = useState<MarksheetConfig | null>(null)
  const [editedData, setEditedData] = useState<ExtractHandwrittenMarksOutput[]>([])
  const [editedStatuses, setEditedStatuses] = useState<ProcessingStatus[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [allErrorsResolved, setAllErrorsResolved] = useState(false)

  // Zoom/Pan state
  const [zoomLevel, setZoomLevel] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const imageContainerRef = useRef<HTMLDivElement>(null)
  const panStartRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const type = searchParams.get("type") as MarksheetType
    const index = searchParams.get("index")
    const sessionId = searchParams.get("sessionId")

    if (type && getMarksheetConfig(type)) {
      setMarksheetType(type)
      setConfig(getMarksheetConfig(type))
    } else {
      toast({
        variant: "destructive",
        title: "Invalid Marksheet Type",
        description: "The URL is missing a valid marksheet type.",
      })
      setIsLoading(false)
      return
    }

    if (sessionId) {
      try {
        const storedData = localStorage.getItem(`marksheet-compare-${sessionId}`)
        if (storedData) {
          const parsedData = JSON.parse(storedData)
          setEditedData(parsedData.extractedData || [])
          setEditedStatuses(parsedData.processingStatuses || [])
          setCurrentIndex(Number.parseInt(index || "0", 10))
          localStorage.removeItem(`marksheet-compare-${sessionId}`)
        } else {
          toast({
            variant: "destructive",
            title: "No Data Found",
            description: "Could not find comparison data.",
          })
        }
      } catch (error) {
        console.error("Failed to parse stored data:", error)
        toast({
          variant: "destructive",
          title: "Data Loading Error",
          description: "Failed to load comparison data.",
        })
      }
    } else {
      toast({
        variant: "destructive",
        title: "Invalid Access",
        description: "This page requires a session ID.",
      })
    }
    setIsLoading(false)
  }, [searchParams, toast])

  const successfulStatuses = useMemo(
    () =>
      editedStatuses.filter(
        (status) => status.status === "success" || status.status === "corrected",
      ),
    [editedStatuses],
  )

  const currentStatus = successfulStatuses[currentIndex]
  const currentEditedItem = useMemo(() => {
    if (!currentStatus?.data) return null
    return (
      editedData.find(
        (item) => item.originalFileName === currentStatus.data!.originalFileName,
      ) || null
    )
  }, [currentStatus, editedData])

  useEffect(() => {
    if (currentStatus?.validationIssues?.length) {
      const issueMessages = currentStatus.validationIssues
        .map((issue) => `• ${issue.message}`)
        .join("\n")

      toast({
        variant: "warning",
        title: `Validation Issues for ${currentStatus.fileName}`,
        description: (
          <pre className="mt-2 w-full rounded-md bg-transparent p-1">
            <code className="text-foreground text-xs whitespace-pre-wrap">
              {issueMessages}
            </code>
          </pre>
        ),
        duration: 5000,
        className: "w-auto min-w-[380px] max-w-lg",
      })
    }
  }, [currentStatus, toast])


  const handleUpdate = useCallback(() => {
    const updatedStatuses = editedStatuses.map((status) =>
      status.fileName === currentStatus?.fileName
        ? {
            ...status,
            status: "corrected" as const,
            isManuallyEdited: false,
            validationIssues: [],
          }
        : status,
    )
    setEditedStatuses(updatedStatuses)
    setHasUnsavedChanges(false)

    const sessionId = `updated-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 9)}`
    localStorage.setItem(
      `marksheet-updated-${sessionId}`,
      JSON.stringify({
        extractedData: editedData,
        processingStatuses: updatedStatuses,
      }),
    )

    if (window.opener) {
      window.opener.postMessage(
        { type: "MARKSHEET_DATA_UPDATED", sessionId },
        window.location.origin,
      )
    }
    toast({ title: "Changes Saved", description: "Your corrections have been saved." })
  }, [editedData, editedStatuses, currentStatus, toast])

  const handleFinish = () => {
    if (hasUnsavedChanges) {
      handleUpdate()
    }
    if (window.opener) {
      window.opener.focus()
      window.close()
    } else {
      router.push("/upload")
    }
  }

  const handleMarkChange = useCallback(
    (questionNumber: string, newMark: string) => {
      if (!currentStatus?.data?.originalFileName) return
      const originalFileName = currentStatus.data.originalFileName

      setEditedData((prev) =>
        prev.map((item) => {
          if (item.originalFileName === originalFileName) {
            const newMarks = [...item.marks]
            const markIndex = newMarks.findIndex(
              (m) => m.questionNumber === questionNumber,
            )
            if (markIndex > -1) {
              newMarks[markIndex] = { ...newMarks[markIndex], mark: newMark }
            } else {
              newMarks.push({ questionNumber, mark: newMark })
            }
            return { ...item, marks: newMarks }
          }
          return item
        }),
      )
      setHasUnsavedChanges(true)
    },
    [currentStatus],
  )

  const handleChange = useCallback(
    (field: keyof Omit<ExtractHandwrittenMarksOutput, "marks">, value: string) => {
      if (!currentStatus?.data?.originalFileName) return
      const originalFileName = currentStatus.data.originalFileName

      setEditedData((prev) =>
        prev.map((item) =>
          item.originalFileName === originalFileName ? { ...item, [field]: value } : item,
        ),
      )
      setHasUnsavedChanges(true)
    },
    [currentStatus],
  )

  // #region Navigation and Keyboard Shortcuts
  const handlePreviousFile = () => setCurrentIndex((prev) => Math.max(0, prev - 1))
  const handleNextFile = () =>
    setCurrentIndex((prev) => Math.min(successfulStatuses.length - 1, prev + 1))

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const activeElement = document.activeElement
      const isInput =
        activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA"

      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        if (hasUnsavedChanges) handleUpdate()
        return
      }

      if (isInput) return

      if (e.key === "ArrowLeft") handlePreviousFile()
      else if (e.key === "ArrowRight") handleNextFile()
    }
    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [currentIndex, successfulStatuses.length, hasUnsavedChanges, handleUpdate])
  // #endregion

  // #region Zoom and Pan Logic
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.2, 3))
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.2, 0.5))
  const handleZoomReset = () => {
    setZoomLevel(1)
    setPan({ x: 0, y: 0 })
  }
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    setZoomLevel((prev) => Math.max(0.5, Math.min(prev - e.deltaY * 0.005, 3)))
  }
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoomLevel > 1) {
      e.preventDefault()
      setIsPanning(true)
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
      if (imageContainerRef.current) imageContainerRef.current.style.cursor = "grabbing"
    }
  }
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
      e.preventDefault()
      setPan({ x: e.clientX - panStartRef.current.x, y: e.clientY - panStartRef.current.y })
    }
  }
  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsPanning(false)
    if (imageContainerRef.current)
      imageContainerRef.current.style.cursor = zoomLevel > 1 ? "grab" : "default"
  }
  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning) handleMouseUp(e)
  }

  useEffect(() => {
    handleZoomReset()
  }, [currentIndex])
  // #endregion

  const renderMarksheetTable = () => {
    if (!config || !currentEditedItem) return null
    switch (config.type) {
      case "cat-3-credits":
        return (
          <Cat3CreditsTable
            editedData={currentEditedItem}
            onMarkChange={handleMarkChange}
            maxMarks={config.maxMarks}
          />
        )
      case "cat-2-credits":
        return (
          <Cat2CreditsTable
            editedData={currentEditedItem}
            onMarkChange={handleMarkChange}
            maxMarks={config.maxMarks}
          />
        )
      case "sem-3-credits":
      case "sem-2-credits":
        return (
          <SemCreditsTable
            editedData={currentEditedItem}
            onMarkChange={handleMarkChange}
            maxMarks={config.maxMarks}
            config={config}
          />
        )
      default:
        return <div>Invalid Marksheet Type</div>
    }
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-gray-50 flex items-center justify-center z-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!config || successfulStatuses.length === 0 || !currentStatus || !currentEditedItem) {
    return (
      <div className="fixed inset-0 bg-gray-50 flex items-center justify-center z-50">
        <div className="text-center p-6">
          <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
          <h1 className="text-xl font-semibold mb-2">No Data Available</h1>
          <p className="text-muted-foreground mb-4">
            Could not load data for comparison. Please try again from the main page.
          </p>
          <Button onClick={() => window.close()}>Close Tab</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col text-sm z-50">
      <div className="flex-1 flex min-h-0 pb-20">
        <div
          ref={imageContainerRef}
          className="w-1/2 relative bg-gray-100 flex items-center justify-center border-r p-1 overflow-hidden"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
          style={{ cursor: isPanning ? "grabbing" : zoomLevel > 1 ? "grab" : "default" }}
        >
          <div
            className="relative w-full h-full flex items-center justify-center transition-transform duration-200"
            style={{ transform: `scale(${zoomLevel}) translate(${pan.x}px, ${pan.y}px)` }}
          >
            {currentStatus.imageUrl ? (
              <img
                src={currentStatus.imageUrl}
                alt={currentStatus.fileName}
                className="max-w-full max-h-full object-contain"
                style={{ pointerEvents: "none" }}
              />
            ) : (
              <div className="text-center text-muted-foreground p-4">
                <Eye className="h-10 w-10 mx-auto mb-2" />
                <p className="text-xs">Image not available</p>
              </div>
            )}
          </div>
          <div className="absolute top-1/2 -translate-y-1/2 right-4 flex flex-col items-center gap-2 bg-black/10 backdrop-blur-sm rounded-full p-1 shadow-lg text-white">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-black/20"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 3}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <span className="text-xs font-medium tabular-nums w-10 text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-black/20"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 0.5}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-black/20"
              onClick={handleZoomReset}
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="w-1/2 bg-white overflow-y-auto">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">
                Extracted Data for <span className="text-primary">{config.name}</span>
              </h3>
              {currentStatus.validationIssues &&
                currentStatus.validationIssues.length > 0 && (
                  <Badge variant="destructive">
                    {currentStatus.validationIssues.length} Issues
                  </Badge>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="name" className="text-xs">
                  Name
                </Label>
                <Input
                  id="name"
                  value={currentEditedItem.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label htmlFor="rollNumber" className="text-xs">
                  Roll Number
                </Label>
                <Input
                  id="rollNumber"
                  value={currentEditedItem.rollNumber}
                  onChange={(e) => handleChange("rollNumber", e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="courseCode" className="text-xs">
                  Course Code
                </Label>
                <Input
                  id="courseCode"
                  value={currentEditedItem.courseCode}
                  onChange={(e) => handleChange("courseCode", e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label htmlFor="totalMarks" className="text-xs">
                  Total Marks
                </Label>
                <Input
                  id="totalMarks"
                  type="text"
                  value={currentEditedItem.totalMarks}
                  onChange={(e) => handleChange("totalMarks", e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>
            {renderMarksheetTable()}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 bg-card border-t p-3 shadow-lg">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className="text-xs font-mono truncate max-w-[150px] sm:max-w-xs"
              title={currentStatus.fileName}
            >
              {currentStatus.fileName}
            </Badge>
            <span className="font-medium text-muted-foreground">
              ({currentIndex + 1} of {successfulStatuses.length})
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousFile}
              disabled={currentIndex === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" />{" "}
              <span className="hidden sm:inline">Previous</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextFile}
              disabled={currentIndex >= successfulStatuses.length - 1}
            >
              <span className="hidden sm:inline">Next</span>{" "}
              <ArrowRight className="h-4 w-4 ml-1 sm:ml-2" />
            </Button>
            {hasUnsavedChanges && (
              <Button
                onClick={handleUpdate}
                className="bg-green-600 hover:bg-green-700"
                size="sm"
              >
                <Save className="h-4 w-4 mr-1 sm:mr-2" />{" "}
                <span className="hidden sm:inline">Update</span>
              </Button>
            )}
            {(allErrorsResolved ||
              (!hasUnsavedChanges && successfulStatuses.length > 0)) && (
              <Button
                onClick={handleFinish}
                className="bg-primary hover:bg-primary/90"
                size="sm"
              >
                <Check className="h-4 w-4 mr-1 sm:mr-2" />{" "}
                <span className="hidden sm:inline">Finish</span>
              </Button>
            )}
            {hasUnsavedChanges && (
              <Badge variant="destructive" className="px-2 py-1 text-xs">
                Unsaved
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground hidden md:block">
            ← → Navigate Files | Ctrl+S Save
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 bg-gray-50 flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      }
    >
      <ComparePageContent />
    </Suspense>
  )
}

    