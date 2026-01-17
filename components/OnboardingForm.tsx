"use client";



import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import PhoneInput from 'react-phone-number-input';

import { formSchema, type FormData } from "@/lib/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm, useFieldArray, useWatch,type FieldPath, type UseFormReturn } from "react-hook-form";
import React, { useState, useEffect } from "react";
// Add useWatch to this list
//import { useForm, useFieldArray,  type FieldPath, type UseFormReturn } from "react-hook-form";
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
import { Checkbox } from "@/components/ui/checkbox"; 

const steps = [
  { id: 1, title: "Initial Settings", description: "Language, source & client type" },
  { id: 2, title: "Client Details", description: "Personal & company information" },
  { id: 3, title: "Course Details", description: "Program & scheduling" },
  { id: 4, title: "Billing & Dates", description: "Payments & validity" },
];

export default function OnboardingForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
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
     // New Address Defaults
      addrStreet: "",
      addrHouse: "",
      addrApt: "",
      addrCity: "",
      addrZip: "",
      addrState: "",
      addrCountry: "Switzerland", // Default country

      companyName: "",
      // New Company Defaults
      compStreet: "",
      compHouse: "",
      compApt: "",
      compCity: "",
      compZip: "",
      compState: "",
      compCountry: "",
      program: "Private tuition",
      courseLang: "German",
      level: [],
      lessons: [{
        type: "Online Lessons",
        format: "60",
        totalHours: 0,
        pricePerHour: 0,
        schedule: ""
      }],
     
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
      // 1. Get the Webhook URL
      const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
      if (!webhookUrl) {
        toast({ title: "Error", description: "Missing Webhook URL configuration." });
        return;
      }

      // --- 2. CALCULATIONS (The Magic) ---

      // A. Calculate Total Hours (Sum of all rows)
      const calculatedTotalHours = data.lessons.reduce((sum, item) => sum + (item.totalHours || 0), 0);

      // B. Calculate Gross Price (Sum of Hours * Price for each row)
      const grossPrice = data.lessons.reduce((sum, item) => {
        return sum + ((item.totalHours || 0) * (item.pricePerHour || 0));
      }, 0);

      // C. Apply Discount %
      // Formula: Gross - (Gross * (Discount / 100))
      const discountMultiplier = 1 - ((data.discount || 0) / 100);
      const finalCalculatedPrice = Math.round(grossPrice * discountMultiplier);

      // D. Create a combined Schedule Text
      const combinedSchedule = data.lessons
        .map(l => `${l.type} (${l.totalHours}h): ${l.schedule}`)
        .join("\n");

      // E. Combine Types and Formats for the PDF summary
      const combinedTypes = data.lessons.map(l => l.type).join(" + ");
      const combinedFormats = data.lessons.map(l => l.format).join(" / ");

      // --- 3. PREPARE PAYLOAD ---
      const payload = {
        body: {
          ...data,
          
          // --- NEW: SEND CALCULATED TOTAL TO N8N ---
          calculatedTotalValue: finalCalculatedPrice, // <--- This is the field you can drag in n8n!

          // --- MAPPED FIELDS (New -> Old Format) ---
          
          // 1. Send the calculated totals to n8n
          totalHours: calculatedTotalHours,
          scheduleText: combinedSchedule,
          lessonType: combinedTypes,       // "Online + Live"
          hoursPerLesson: combinedFormats, // "60 / 90"

          // 2. Smart Payment Logic:
          // If the user left "Pay 1 Amount" empty (Step 4), use our calculated total.
          // If they typed something (e.g. a deposit), respect their input.
          pay1Amount: data.pay1Amount || finalCalculatedPrice,
          
          // 3. Price Reference (First lesson's price)
          pricePerHour: data.lessons[0].pricePerHour,

          // 4. Level: Array -> String
          level: Array.isArray(data.level) ? data.level.join(", ") : data.level,

          // 5. Address: Stitch fields into one text block
          address: `${data.addrStreet} ${data.addrHouse}${data.addrApt ? ', Apt ' + data.addrApt : ''}\n${data.addrZip} ${data.addrCity}\n${data.addrState}, ${data.addrCountry}`,

          // 6. Company Address
          companyAddress: data.clientType === 'business' 
            ? `${data.compStreet} ${data.compHouse}${data.compApt ? ', Apt ' + data.compApt : ''}\n${data.compZip} ${data.compCity}\n${data.compState}, ${data.compCountry}`
            : "",

          // 7. Dates
          contractDate: data.contractDate.toString(),
        }
      };

      // 4. Send to n8n
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error();

      toast({
        title: "Success! 🚀",
        description: `Contract generated. Total Value: ${finalCalculatedPrice} CHF`,
      });
      
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Submission failed",
        description: "Could not reach n8n. Please check your internet connection.",
      });
    }
  };
 if (!mounted) {
    return null; 
  }
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
       <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
  console.log("❌ FORM ERRORS:", errors);
  // toast({
  //   variant: "destructive",
  //   title: "Validation Failed",
  //   description: "Check the console (F12) to see which field is missing."
  // });
})}>
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
                    <PhoneField form={form} name="phone" label="Phone" />
                    
                    {/* 👇 NEW CLIENT ADDRESS GROUP 👇 */}
                    <AddressGroup form={form} prefix="addr" label="Private Address" />

                    {clientType === "business" && (
                      <div className="space-y-5 pt-4 border-t">
                        <TextField form={form} name="companyName" label="Company Name" />
                        {/* 👇 NEW COMPANY ADDRESS GROUP 👇 */}
                        <AddressGroup form={form} prefix="comp" label="Company Address" />
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 3 */}
               {/* STEP 3 */}
                {currentStep === 2 && (
                  <div className="space-y-5">
                    {/* 1. Language Selection */}
                    <SelectField form={form} name="courseLang" label="Course Language" items={["German", "Spanish"]} />
                    
                    {/* 2. Multi-Select Levels */}
                    <MultiSelectField 
                      form={form} 
                      name="level" 
                      label="Level" 
                      items={["A1", "A2", "B1", "B2", "C1", "C2"]} 
                    />

                    {/* 3. 👇 THE NEW DYNAMIC LESSON LIST 👇 */}
                    {/* This replaces lessonType, hoursPerLesson, totalHours, pricePerHour, scheduleText */}
                    <LessonList form={form} />

                    {/* 4. Global Discount (Applies to everything) */}
                    <div className="pt-4 border-t">
                      <NumberField form={form} name="discount" label="Global Discount %" />
                      <LiveTotalSummary form={form} />
                    </div>
                    
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
              value={(field.value as any) ?? ""}
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
      const baseFields: FieldPath<FormData>[] = [
        "firstName", "lastName", "email", "phone", 
        "addrStreet", "addrHouse", "addrCity", "addrZip", "addrState", "addrCountry"
      ];
      return values.clientType === "business"
        ? [...baseFields, "companyName", "compStreet", "compHouse", "compCity", "compZip", "compState", "compCountry"]
        : baseFields;

    case 2:
      // 👇 THIS IS THE IMPORTANT CHANGE
      // We validate 'lessons' (the whole array) instead of individual fields
      return ["courseLang", "level", "program", "discount", "lessons"];
    
    case 3:
      return ["courseStart", "courseEnd", "validUntil", "pay1Date", "pay1Amount"];
    
    default:
      return [];
  }
}
function MultiSelectField({ form, name, label, items }: FieldCommonProps & { items: string[] }) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={() => (
        <FormItem>
          <div className="mb-4">
            <FormLabel className="text-sm font-medium text-slate-700">{label}</FormLabel>
          </div>
          <div className="grid grid-cols-3 gap-4"> {/* Grid for nice layout */}
            {items.map((item) => (
              <FormField
                key={item}
                control={form.control}
                name={name}
                render={({ field }) => {
                  return (
                    <FormItem
                      key={item}
                      className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm"
                    >
                      <FormControl>
                        <Checkbox
                          checked={field.value?.includes(item)}
                          onCheckedChange={(checked) => {
                            return checked
                              ? field.onChange([...(field.value || []), item])
                              : field.onChange(
                                  field.value?.filter((value: string) => value !== item)
                                );
                          }}
                        />
                      </FormControl>
                      <FormLabel className="font-normal cursor-pointer text-sm">
                        {item}
                      </FormLabel>
                    </FormItem>
                  );
                }}
              />
            ))}
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
function PhoneField({ form, name, label }: FieldCommonProps) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-sm font-medium text-slate-700">{label}</FormLabel>
          <FormControl>
            <div className="flex h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              <PhoneInput
                placeholder="Enter phone number"
                value={field.value as string}
                onChange={field.onChange}
                defaultCountry="CH" // Sets Switzerland as default (Change to DE or US if preferred)
                international
                className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function AddressGroup({ form, prefix, label }: { form: UseFormReturn<FormData>, prefix: string, label: string }) {
  // prefix is either "addr" or "comp"
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <p className="text-sm font-semibold text-slate-900">{label}</p>
      
      <div className="grid grid-cols-6 gap-3">
        {/* Street (Span 4) & House (Span 2) */}
        <div className="col-span-4">
          <TextField form={form} name={`${prefix}Street` as any} label="Street" />
        </div>
        <div className="col-span-2">
          <TextField form={form} name={`${prefix}House` as any} label="No." />
        </div>

        {/* Apt (Span 2) & City (Span 4) */}
        <div className="col-span-2">
          <TextField form={form} name={`${prefix}Apt` as any} label="Apt (Opt)" />
        </div>
        <div className="col-span-4">
          <TextField form={form} name={`${prefix}City` as any} label="City" />
        </div>

        {/* Zip (Span 2), State (Span 2), Country (Span 2) */}
        <div className="col-span-2">
           <TextField form={form} name={`${prefix}Zip` as any} label="Zip" />
        </div>
        <div className="col-span-2">
           <TextField form={form} name={`${prefix}State` as any} label="State" />
        </div>
        <div className="col-span-2">
           <TextField form={form} name={`${prefix}Country` as any} label="Country" />
        </div>
      </div>
    </div>
  );
}
function LessonList({ form }: { form: UseFormReturn<FormData> }) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lessons",
  });

  return (
    <div className="space-y-4">
      {fields.map((field, index) => (
        <div key={field.id} className="relative rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900">Lesson Option {index + 1}</h4>
            {fields.length > 1 && (
              <Button type="button" variant="destructive" size="sm" onClick={() => remove(index)}>
                Remove
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <SelectField 
              form={form} 
              name={`lessons.${index}.type` as any} 
              label="Type" 
              items={["Online Lessons", "Live Lessons"]} 
            />
            <SelectField 
              form={form} 
              name={`lessons.${index}.format` as any} 
              label="Format (Min)" 
              items={["45", "60", "90", "120"]} 
            />
            <NumberField 
              form={form} 
              name={`lessons.${index}.totalHours` as any} 
              label="Total Hours" 
            />
            <NumberField 
              form={form} 
              name={`lessons.${index}.pricePerHour` as any} 
              label="Price/Hr (CHF)" 
            />
            
            {/* 👇 REPLACED THE OLD TEXTFIELD WITH SCHEDULE BUILDER 👇 */}
            <div className="col-span-2">
              <ScheduleBuilder form={form} index={index} />
            </div>

          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={() => append({ 
          type: "Online Lessons", 
          format: "60", 
          totalHours: 0, 
          pricePerHour: 0, 
          schedule: "" 
        })}
        className="w-full border-dashed"
      >
        + Add Another Lesson Type
      </Button>
    </div>
  );
}
function LiveTotalSummary({ form }: { form: UseFormReturn<FormData> }) {
  // Watch specific fields for changes
  const lessons = useWatch({ control: form.control, name: "lessons" });
  const discount = useWatch({ control: form.control, name: "discount" }) || 0;

  // 1. Calculate Gross (Sum of all rows)
  const grossTotal = lessons?.reduce((sum, item) => {
    const hours = Number(item.totalHours) || 0;
    const price = Number(item.pricePerHour) || 0;
    return sum + (hours * price);
  }, 0) || 0;

  // 2. Calculate Discount Amount
  const discountAmount = (grossTotal * discount) / 100;

  // 3. Calculate Final Net
  const netTotal = grossTotal - discountAmount;

  if (grossTotal === 0) return null; // Hide if nothing is entered

  return (
    <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
      <div className="flex justify-between text-sm text-slate-600">
        <span>Subtotal (Gross):</span>
        <span>{grossTotal.toFixed(2)} CHF</span>
      </div>
      
      {discount > 0 && (
        <div className="flex justify-between text-sm text-green-600">
          <span>Discount ({discount}%):</span>
          <span>- {discountAmount.toFixed(2)} CHF</span>
        </div>
      )}
      
      <div className="mt-2 flex justify-between border-t border-blue-200 pt-2 text-lg font-bold text-blue-900">
        <span>Total Value:</span>
        <span>{netTotal.toFixed(2)} CHF</span>
      </div>
    </div>
  );
}

/* ------------------ Schedule Builder Helper ------------------ */

// 1. Helper to convert "14:30" -> 870 minutes
const timeToMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

// 2. The Component
function ScheduleBuilder({ form, index }: { form: UseFormReturn<FormData>; index: number }) {
  // We use local state to manage the inputs before adding them
  const [day, setDay] = useState("Monday");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [error, setError] = useState<string | null>(null);

  // We watch the current string value to render the list
  // The format in the database is: "Monday 09:00-10:00, Tuesday 14:00-15:00"
  const currentScheduleStr = form.watch(`lessons.${index}.schedule`) || "";
  
  // Parse the string into an array for display/validation
  const slots = currentScheduleStr ? currentScheduleStr.split(", ").filter(Boolean).map(s => {
    // Format: "Monday 09:00-10:00"
    const [d, times] = s.split(" ");
    const [start, end] = times.split("-");
    return { day: d, start, end };
  }) : [];

  const addSlot = () => {
    setError(null);
    if (!startTime || !endTime) return setError("Enter both times.");
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) return setError("End time must be after start.");

    // OVERLAP CHECK 🛡️
    const newStart = timeToMinutes(startTime);
    const newEnd = timeToMinutes(endTime);

    const hasOverlap = slots.some(slot => {
      if (slot.day !== day) return false; // Different days don't overlap
      const existStart = timeToMinutes(slot.start);
      const existEnd = timeToMinutes(slot.end);
      // Logic: (StartA < EndB) and (EndA > StartB)
      return newStart < existEnd && newEnd > existStart;
    });

    if (hasOverlap) {
      return setError("❌ Time overlaps with an existing slot!");
    }

    // Add to list
    const newSlotStr = `${day} ${startTime}-${endTime}`;
    const newSchedule = currentScheduleStr ? `${currentScheduleStr}, ${newSlotStr}` : newSlotStr;
    
    // Update the actual form
    form.setValue(`lessons.${index}.schedule`, newSchedule, { shouldValidate: true });
    
    // Reset inputs
    setStartTime("");
    setEndTime("");
  };

  const removeSlot = (slotIndex: number) => {
    const newSlots = slots.filter((_, i) => i !== slotIndex);
    // Rebuild the string
    const newString = newSlots.map(s => `${s.day} ${s.start}-${s.end}`).join(", ");
    form.setValue(`lessons.${index}.schedule`, newString);
  };

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
      <FormLabel className="text-sm font-medium text-slate-700">Schedule Slots</FormLabel>
      
      {/* List of added slots */}
      <div className="flex flex-wrap gap-2 mb-2">
        {slots.map((slot, i) => (
          <div key={i} className="flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-700 border border-blue-100">
            <span>{slot.day.slice(0,3)} {slot.start}-{slot.end}</span>
            <button type="button" onClick={() => removeSlot(i)} className="ml-1 text-blue-400 hover:text-red-500 font-bold">×</button>
          </div>
        ))}
        {slots.length === 0 && <span className="text-xs text-slate-400 italic">No slots added yet.</span>}
      </div>

      {/* Inputs to add new */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
           <label className="text-[10px] text-slate-500 uppercase font-bold">Day</label>
           <select 
             className="h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
             value={day} onChange={e => setDay(e.target.value)}
           >
             {days.map(d => <option key={d} value={d}>{d}</option>)}
           </select>
        </div>
        <div className="w-24">
           <label className="text-[10px] text-slate-500 uppercase font-bold">Start</label>
           <Input type="time" className="h-9" value={startTime} onChange={e => setStartTime(e.target.value)} />
        </div>
        <div className="w-24">
           <label className="text-[10px] text-slate-500 uppercase font-bold">End</label>
           <Input type="time" className="h-9" value={endTime} onChange={e => setEndTime(e.target.value)} />
        </div>
        <Button type="button" size="sm" onClick={addSlot} className="h-9 px-3 bg-slate-900 text-white hover:bg-slate-800">
          +
        </Button>
      </div>
      {error && <p className="text-xs text-red-500 font-medium mt-1">{error}</p>}
    </div>
  );
}