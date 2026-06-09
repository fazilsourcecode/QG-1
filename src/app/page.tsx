
'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, NotebookPen, NotebookText, BookMarked, BookCopy, Upload, Eye, Zap, ListChecks, RefreshCw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

const marksheetTypes = [
  {
    id: 'cat-classic',
    title: 'CAT Classic',
    subtitle: '3-credit internal exam',
    badgeText: 'CAT',
    link: '/upload',
    icon: <NotebookPen className="w-8 h-8 mb-3 text-primary" />,
  },
  {
    id: 'cat-lite',
    title: 'CAT Lite',
    subtitle: '2-credit internal exam',
    badgeText: 'CAT',
    link: '/upload/cat-2-credits',
    icon: <NotebookText className="w-8 h-8 mb-3 text-primary" />,
  },
  {
    id: 'sem-classic',
    title: 'SEM Classic',
    subtitle: '3-credit semester exam',
    badgeText: 'SEM',
    link: '/upload/sem-3-credits',
    icon: <BookMarked className="w-8 h-8 mb-3 text-primary" />,
  },
  {
    id: 'sem-lite',
    title: 'SEM Lite',
    subtitle: '2-credit semester exam',
    badgeText: 'SEM',
    link: '/upload/sem-2-credits',
    icon: <BookCopy className="w-8 h-8 mb-3 text-primary" />,
  },
];

const features = [
  {
    title: 'Batch Upload Marksheets',
    icon: <Upload className="w-6 h-6 text-primary" />,
    description: 'Easily upload multiple marksheets in image (JPG, PNG) or ZIP format for efficient processing.',
    link: '/upload',
  },
  {
    title: 'AI-Powered Data Extraction',
    icon: <Zap className="w-6 h-6 text-primary" />,
    description: 'Leverage advanced AI to accurately extract student details, roll numbers, and marks from each sheet.',
  },
  {
    title: 'Real-time Status Tracking',
    icon: <ListChecks className="w-6 h-6 text-primary" />,
    description: 'Monitor the processing status of each marksheet (pending, success, error, retrying) in real-time.',
  },
  {
    title: 'Automated & Manual Retries',
    icon: <RefreshCw className="w-6 h-6 text-primary" />,
    description: 'Benefit from an automatic retry mechanism for failed files, or manually retry specific marksheets.',
  },
  {
    title: 'Image Preview & Data Review',
    icon: <Eye className="w-6 h-6 text-primary" />,
    description: 'Review the original marksheet image alongside the extracted data for verification and accuracy.',
  },
  {
    title: 'Export to Excel',
    icon: <Download className="w-6 h-6 text-primary" />,
    description: 'Download all extracted and verified data conveniently into an Excel file for record-keeping and analysis.',
  },
];

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] px-4 py-8">
      <Card className="w-full max-w-5xl p-6 sm:p-8 rounded-xl shadow-2xl bg-card text-card-foreground">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-3xl sm:text-4xl font-bold mb-2 text-primary">
            Welcome to Quick Grade!
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Select the type of marksheet you want to process.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-6">
            {marksheetTypes.map((type) => (
              <Link href={type.link} key={type.id} className="group block">
                <div className="relative p-6 bg-background border border-border rounded-xl shadow-md hover:shadow-2xl hover:-translate-y-1 hover:scale-105 hover:bg-gradient-to-br from-background to-primary/10 transition-all duration-300 ease-in-out h-full flex flex-col">
                  <Badge variant="outline" className="absolute top-3 right-3 bg-primary/10 text-primary border-primary/30">
                    {type.badgeText}
                  </Badge>
                  {type.icon}
                  <h3 className="text-xl font-semibold mb-1 text-foreground group-hover:text-primary transition-colors duration-300">
                    {type.title}
                  </h3>
                  <div className="text-sm text-muted-foreground transition-all duration-300 ease-in-out max-h-0 opacity-0 group-hover:max-h-20 group-hover:opacity-100 group-hover:mt-1 overflow-hidden">
                    {type.subtitle}
                  </div>
                  <div className="mt-auto pt-3">
                    <div className="flex items-center text-sm font-medium text-primary opacity-0 transform -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 ease-in-out">
                      Start Upload
                      <ArrowRight className="ml-1.5 h-4 w-4 group-hover:animate-pulse" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="pt-8 mt-8 border-t border-border">
            <h2 className="text-2xl font-semibold text-center mb-8 text-foreground">Key Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-start space-x-4 p-4 rounded-lg border bg-background hover:shadow-lg transition-shadow duration-300"
                >
                  <div className="flex-shrink-0 mt-1 text-primary bg-primary/10 p-2 rounded-full">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-1 text-foreground">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                    {feature.link && (
                       <Button asChild variant="link" className="px-0 h-auto mt-2 text-primary hover:text-primary/80">
                          <Link href={feature.link}>Go to Upload Page &rarr;</Link>
                       </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
           
           <div className="text-center mt-10 pt-6 border-t border-border">
            <Button size="lg" asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Link href="/upload"> 
                <Upload className="mr-2 h-5 w-5" />
                 Upload MarkSheets 
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
