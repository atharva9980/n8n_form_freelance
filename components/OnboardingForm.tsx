"use client";

import React, { useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { formSchema, FormData } from "@/lib/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const steps = [
  { id: 1, title: "Initial Settings", description: "Contract language, source, and client type" },
  { id: 2, title: "Client Details", description: "Personal and (optional) company information" },
  { id: 3, title: "Course Details", description: "Program, level, and scheduling" },
  { id: 4, title: "Billing & Dates", description: "Payments and Contract Validity" }
];

export default function OnboardingForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const { toast } = useToast();
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      language: "English",
      source: "Website",
      contractDate: new Date().toISOString().split('T')[0],
      clientType: "private",
      // Step 2
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      companyName: "",
      companyAddress: "",
      // Step 3
      program: "Private tuition",
      courseLang: "German",
      level: "",
      lessonType: "",
      totalHours: undefined,
      pricePerHour: undefined,
      hoursPerLesson: "60",
      discount: 0,
      scheduleText: "",
      // Step 4
      courseStart: "",
      courseEnd: "",
      validUntil: "",
      pay1Date: "",
      pay1Amount: undefined,
      pay2Date: "",
      pay2Amount: undefined,
      pay3Date: "",
      pay3Amount: undefined,
    }
  });

  const next = async () => {
    const fields = getFieldsForStep(currentStep, form.getValues());
    const isValid = await form.trigger(fields);
    if (isValid) {
      setCurrentStep((s) => s + 1);
    } else {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please fill in all required fields highlighted in red.",
      });
    }
  };

  const prev = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        toast({ title: "Submission Success", description: "The workflow has been triggered." });
      } else {
        throw new Error();
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Could not send data to the server." });
    }
  };

  const clientType = form.watch("clientType");

  return (
    <Card className="w-full max-w-2xl mx-auto overflow-hidden">
      <CardHeader className="bg-slate-50/50 border-b">
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs font-bold uppercase text-slate-500">Step {currentStep + 1} of {steps.length}</span>
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div key={i} className={`h-1.5 w-8 rounded-full ${i <= currentStep ? "bg-primary" : "bg-slate-200"}`} />
            ))}
          </div>
        </div>
        <CardTitle>{steps[currentStep].title}</CardTitle>
        <CardDescription>{steps[currentStep].description}</CardDescription>
      </CardHeader>
      
      <CardContent className="pt-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ x: 10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -10, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* Step 1: Settings */}
                {currentStep === 0 && (
                  <div className="space-y-4">
                    <FormField control={form.control} name="language" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Language</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent><SelectItem value="English">English</SelectItem><SelectItem value="German">German</SelectItem></SelectContent>
                        </Select><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="source" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Source</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent><SelectItem value="Recommendation">Recommendation</SelectItem><SelectItem value="Website">Website</SelectItem></SelectContent>
                        </Select><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="contractDate" render={({ field }) => (
                      <FormItem><FormLabel>Contract Date</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="clientType" render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Client Type</FormLabel>
                        <FormControl>
                          <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex items-center space-x-4">
                            <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="private" /></FormControl><FormLabel className="font-normal">Private</FormLabel></FormItem>
                            <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="business" /></FormControl><FormLabel className="font-normal">Business</FormLabel></FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                )}

                {/* Step 2: Details */}
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <FormField control={form.control} name="firstName" render={({ field }) => (
                      <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                      )} />
                    <FormField control={form.control} name="lastName" render={({ field }) => (
                      <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                      )} />
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                      )} />
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                      )} />
                    <FormField control={form.control} name="address" render={({ field }) => (
                      <FormItem><FormLabel>Address</FormLabel><FormControl><Textarea {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                      )} />
                    
                    {clientType === 'business' && (
                      <div className="space-y-4 pt-4 border-t">
                        <FormField control={form.control} name="companyName" render={({ field }) => (
                          <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                          )} />
                        <FormField control={form.control} name="companyAddress" render={({ field }) => (
                          <FormItem><FormLabel>Company Address</FormLabel><FormControl><Textarea {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                          )} />
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Course */}
                {currentStep === 2 && (
                  <div className="space-y-4">
                    <FormField control={form.control} name="program" render={({ field }) => (
                      <FormItem><FormLabel>Program</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Private tuition">Private tuition</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="courseLang" render={({ field }) => (
                      <FormItem><FormLabel>Course Language</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="German">German</SelectItem><SelectItem value="Spanish">Spanish</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="level" render={({ field }) => (
                      <FormItem><FormLabel>Level</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent>{["A1","A2","B1","B2","C1","C2"].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="lessonType" render={({ field }) => (
                      <FormItem><FormLabel>Lesson Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Online Lessons">Online Lessons</SelectItem><SelectItem value="Live Lessons">Live Lessons</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="totalHours" render={({ field }) => (
                      <FormItem><FormLabel>Total Hours</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="hoursPerLesson" render={({ field }) => (
                      <FormItem><FormLabel>Mins per Lesson</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{["45", "60", "90", "120"].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="pricePerHour" render={({ field }) => (
                      <FormItem><FormLabel>Price Per Hour</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="discount" render={({ field }) => (
                      <FormItem><FormLabel>Discount %</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="scheduleText" render={({ field }) => (
                      <FormItem><FormLabel>Schedule</FormLabel><FormControl><Input placeholder="e.g. Mondays 14:00" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                )}

                {/* Step 4: Billing */}
                {currentStep === 3 && (
                  <div className="space-y-4">
                    <FormField control={form.control} name="courseStart" render={({ field }) => (
                    <FormItem><FormLabel>Course Start</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="courseEnd" render={({ field }) => (
                    <FormItem><FormLabel>Course End</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="validUntil" render={({ field }) => (
                    <FormItem><FormLabel>Valid Until</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="space-y-3 pt-4 border-t">
                      <p className="text-sm font-medium">Payment Installments</p>
                      <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border">
                        <FormField control={form.control} name="pay1Date" render={({ field }) => (
                          <FormItem><FormLabel>Payment 1 Date</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="pay1Amount" render={({ field }) => (
                          <FormItem><FormLabel>Amount</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border">
                        <FormField control={form.control} name="pay2Date" render={({ field }) => (
                          <FormItem><FormLabel>Payment 2 Date (Optional)</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="pay2Amount" render={({ field }) => (
                          <FormItem><FormLabel>Amount</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border">
                        <FormField control={form.control} name="pay3Date" render={({ field }) => (
                          <FormItem><FormLabel>Payment 3 Date (Optional)</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="pay3Amount" render={({ field }) => (
                          <FormItem><FormLabel>Amount</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="flex justify-between pt-4 border-t">
              <Button type="button" variant="outline" onClick={prev} disabled={currentStep === 0}>Back</Button>
              {currentStep === steps.length - 1 ? (
                <Button type="submit">Complete</Button>
              ) : (
                <Button type="button" onClick={next}>Next</Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function getFieldsForStep(step: number, values: FormData): FieldPath<FormData>[] {
  switch (step) {
    case 0: return ["language", "source", "contractDate", "clientType"];
    case 1: {
      const baseFields: FieldPath<FormData>[] = ["firstName", "lastName", "email", "phone", "address"];
      if (values.clientType === 'business') {
        return [...baseFields, "companyName", "companyAddress"];
      }
      return baseFields;
    }
    case 2: return [
      "program", "courseLang", "level", "lessonType", "totalHours", 
      "pricePerHour", "hoursPerLesson", "discount", "scheduleText"
    ];
    case 3: return [
      "courseStart", "courseEnd", "validUntil", "pay1Date", "pay1Amount"
    ];
    default: return [];
  }
}