"use client";

import React, { useState } from "react";
import { useForm, type FieldPath, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";

import { formSchema, type FormData } from "@/lib/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
  CardDescription,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const steps = [
  { id: 1, title: "Initial Settings", description: "Language, source & client type" },
  { id: 2, title: "Client Details", description: "Personal & company information" },
  { id: 3, title: "Course Details", description: "Program & scheduling" },
  { id: 4, title: "Billing & Dates", description: "Payments & validity" },
];

export default function OnboardingForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema) as any ,
    mode: "onChange",
    defaultValues: {
      language: "English" as const,
      source: "Website" as const,
      contractDate: new Date().toISOString().split("T")[0],
      clientType: "private",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      companyName: "",
      companyAddress: "",
      program: "Private tuition",
      courseLang: "German",
      level: "",
      lessonType: "",
      totalHours: undefined,
      pricePerHour: undefined,
      hoursPerLesson: "60",
      discount: 0,
      scheduleText: "",
      courseStart: "",
      courseEnd: "",
      validUntil: "",
      pay1Date: "",
      pay1Amount: undefined,
      pay2Date: "",
      pay3Date: "",
      pay2Amount: undefined,
      pay3Amount: undefined,
    },
  });

  const clientType = form.watch("clientType");

  const next = async () => {
    const fields = getFieldsForStep(currentStep, form.getValues());
    const valid = await form.trigger(fields);
    if (!valid) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please complete required fields.",
      });
      return;
    }
    setCurrentStep((s) => s + 1);
  };

  const prev = () => setCurrentStep((s) => Math.max(0, s - 1));

  const onSubmit = async (data: FormData) => {
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error();

      toast({
        title: "Success",
        description: "Workflow triggered successfully.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Submission failed",
        description: "Please try again.",
      });
    }
  };

  return (
    <Card className="w-full max-w-xl mx-auto rounded-2xl shadow-sm border border-slate-200 bg-white my-8">
      <CardHeader className="pb-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">
            Step {currentStep + 1} of {steps.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-1 rounded-full flex-1 transition-colors ${
                currentStep >= index ? 'bg-primary' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>

        <div className="pt-2">
          <CardTitle className="text-xl font-semibold">
            {steps[currentStep].title}
          </CardTitle>
          <CardDescription className="text-sm text-slate-500">
            {steps[currentStep].description}
          </CardDescription>
        </div>
      </CardHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="min-h-[400px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="space-y-5"
              >
                {/* STEP 1 */}
                {currentStep === 0 && (
                  <div className="space-y-5">
                    <SelectField form={form} name="language" label="Language" items={["English", "German"]} />
                    <SelectField form={form} name="source" label="Source" items={["Website", "Recommendation"]} />
                    <DateField form={form} name="contractDate" label="Contract Date" />
                    <FormField
                      control={form.control}
                      name="clientType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-slate-700">Client Type</FormLabel>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="grid grid-cols-2 gap-3"
                          >
                            {["private", "business"].map((v) => (
                              <label
                                key={v}
                                className={`flex items-center justify-center rounded-lg border p-3 text-sm cursor-pointer transition-all
                                ${field.value === v
                                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                                  : "border-slate-200 bg-white hover:bg-slate-50"
                                }`}
                              >
                                <RadioGroupItem value={v} className="hidden" />
                                {v === "private" ? "Private Client" : "Business Client"}
                              </label>
                            ))}
                          </RadioGroup>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* STEP 2 */}
                {currentStep === 1 && (
                  <div className="space-y-5">
                    <TextField form={form} name="firstName" label="First Name" />
                    <TextField form={form} name="lastName" label="Last Name" />
                    <TextField form={form} name="email" label="Email" type="email" />
                    <TextField form={form} name="phone" label="Phone" />
                    <TextareaField form={form} name="address" label="Address" />

                    {clientType === "business" && (
                      <div className="space-y-5 pt-4 border-t">
                        <TextField form={form} name="companyName" label="Company Name" />
                        <TextareaField form={form} name="companyAddress" label="Company Address" />
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 3 */}
                {currentStep === 2 && (
                  <div className="space-y-5">
                    <SelectField form={form} name="courseLang" label="Course Language" items={["German", "Spanish"]} />
                    <SelectField form={form} name="level" label="Level" items={["A1","A2","B1","B2","C1","C2"]} />
                    <SelectField form={form} name="lessonType" label="Lesson Type" items={["Online Lessons","Live Lessons"]} />
                    <SelectField form={form} name="hoursPerLesson" label="Minutes per Lesson" items={["45", "60", "90", "120"]} />
                    <NumberField form={form} name="totalHours" label="Total Hours" />
                    <NumberField form={form} name="pricePerHour" label="Price Per Hour" />
                    <NumberField form={form} name="discount" label="Discount %" />
                    <TextField form={form} name="scheduleText" label="Schedule" />
                  </div>
                )}

                {/* STEP 4 */}
                {currentStep === 3 && (
                  <div className="space-y-5">
                    <DateField form={form} name="courseStart" label="Course Start" />
                    <DateField form={form} name="courseEnd" label="Course End" />
                    <DateField form={form} name="validUntil" label="Valid Until" />

                    <div className="space-y-4 pt-4 border-t">
                      <p className="text-sm font-semibold text-slate-900">Payment Plan</p>
                      <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 border border-slate-200">
                        <DateField form={form} name="pay1Date" label="Payment 1 Date" />
                        <NumberField form={form} name="pay1Amount" label="Amount" />
                      </div>
                      <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 border border-slate-200">
                        <DateField form={form} name="pay2Date" label="Payment 2 Date (Optional)" />
                        <NumberField form={form} name="pay2Amount" label="Amount" />
                      </div>
                      <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 border border-slate-200">
                        <DateField form={form} name="pay3Date" label="Payment 3 Date (Optional)" />
                        <NumberField form={form} name="pay3Amount" label="Amount" />
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </CardContent>
          <CardFooter className="bg-white p-6 border-t flex gap-3">
              <Button type="button" variant="outline" className="flex-1 h-11" onClick={prev} disabled={currentStep === 0}>
                Back
              </Button>
              {currentStep === steps.length - 1 ? (
                <Button type="submit" className="flex-1 h-11">Submit</Button>
              ) : (
                <Button type="button" className="flex-1 h-11" onClick={next}>Continue</Button>
              )}
          </CardFooter>
          </form>
        </Form>
    </Card>
  );
}

/* ------------------ Helpers ------------------ */

interface FieldCommonProps {
  form: UseFormReturn<FormData>;
  name: FieldPath<FormData>;
  label: string;
}

function TextField({ form, name, label, type = "text" }: FieldCommonProps & { type?: string }) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-sm font-medium text-slate-700">{label}</FormLabel>
          <FormControl>
            <Input 
              {...field} 
              type={type} 
              value={(field.value as string) || ""} 
              className="h-11 rounded-lg bg-slate-50 border-slate-200 focus:border-primary focus:ring-0" 
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function TextareaField({ form, name, label }: FieldCommonProps) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-sm font-medium text-slate-700">{label}</FormLabel>
          <FormControl>
            <Textarea 
              {...field} 
              value={(field.value as string) || ""}
              className="min-h-[90px] rounded-lg bg-slate-50 border-slate-200 focus:border-primary focus:ring-0" 
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function SelectField({ form, name, label, items }: FieldCommonProps & { items: string[] }) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-sm font-medium text-slate-700">{label}</FormLabel>
          <Select onValueChange={field.onChange} value={(field.value as string) || undefined}>
            <FormControl>
              <SelectTrigger className="h-11 rounded-lg bg-slate-50 border-slate-200">
                <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {items.map((i) => (
                <SelectItem key={i} value={i}>{i}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function NumberField({ form, name, label }: FieldCommonProps) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-sm font-medium text-slate-700">{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              className="h-11 rounded-lg bg-slate-50 border-slate-200 focus:border-primary focus:ring-0"
              value={field.value ?? ""}
              onChange={(e) =>
                field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function DateField({ form, name, label }: FieldCommonProps) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-sm font-medium text-slate-700">{label}</FormLabel>
          <FormControl>
            <Input 
              type="date" 
              {...field} 
              value={(field.value as string) || ''} 
              className="h-11 rounded-lg bg-slate-50 border-slate-200 focus:border-primary focus:ring-0" 
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function getFieldsForStep(step: number, values: FormData): FieldPath<FormData>[] {
  switch (step) {
    case 0:
      return ["language", "source", "contractDate", "clientType"];
    case 1:
      return values.clientType === "business"
        ? ["firstName", "lastName", "email", "phone", "address", "companyName", "companyAddress"]
        : ["firstName", "lastName", "email", "phone", "address"];
    case 2:
      return ["courseLang", "level", "lessonType", "totalHours", "pricePerHour", "scheduleText", "hoursPerLesson"];
    case 3:
      return ["courseStart", "courseEnd", "validUntil", "pay1Date", "pay1Amount"];
    default:
      return [];
  }
}
