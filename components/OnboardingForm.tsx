"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import PhoneInput from "react-phone-number-input";
import countryList from "react-select-country-list";

// Make sure your Schema in @/lib/schema has the 'payments' array defined!
import { formSchema, type FormData } from "@/lib/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useForm, useFieldArray, useWatch, type FieldPath, type UseFormReturn } from "react-hook-form";
import React, { useState, useEffect, useMemo } from "react";
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

const allPossibleSteps = [
  { id: 'settings', title: "Initial Settings", description: "Language, source & client type" },
  { id: 'client', title: "Client Details", description: "Personal information" },
  { id: 'company', title: "Company Details", description: "Business name and address", businessOnly: true },
  { id: 'course', title: "Course Details", description: "Program & scheduling" },
  { id: 'billing', title: "Billing & Dates", description: "Payments & validity" },
];

export default function OnboardingForm() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
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
      
      // Address Defaults
      addrStreet: "",
      addrHouse: "",
      addrApt: "",
      addrCity: "",
      addrZip: "",
      addrState: "",
      addrCountry: "Switzerland",

      companyName: "",
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
      
      // 👇 NEW DYNAMIC PAYMENTS INIT
      payments: [{ date: "", amount: 0 }],

      hoursPerLesson: "60",
      discount: 0,
      scheduleText: "",
      courseStart: "",
      courseEnd: "",
      validUntil: "",
    },
  });

  const clientType = form.watch("clientType");

  const steps = useMemo(() => {
    return allPossibleSteps.filter(step => !step.businessOnly || clientType === 'business');
  }, [clientType]);

  useEffect(() => {
    // When the available steps change (e.g., switching client type),
    // check if the current step is still valid. If not, reset to the first step.
    if (currentStepIndex >= steps.length) {
      setCurrentStepIndex(0);
    }
  }, [steps, currentStepIndex]);

  // --- LIVE CALCULATION FOR PAYMENT BUILDER ---
  const watchedLessons = useWatch({ control: form.control, name: "lessons" });
  const watchedDiscount = useWatch({ control: form.control, name: "discount" }) || 0;
  
  const grossTotal = watchedLessons?.reduce((sum, item) => {
    return sum + ((Number(item.totalHours) || 0) * (Number(item.pricePerHour) || 0));
  }, 0) || 0;
  
  const liveTotalValue = Math.round(grossTotal * (1 - (watchedDiscount / 100)));
  // ---------------------------------------------

  const next = async () => {
    const fields = getFieldsForStep(currentStepIndex, steps, form.getValues());
    const valid = await form.trigger(fields);
    if (!valid) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please complete required fields.",
      });
      return;
    }
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((s) => s + 1);
    }
  };

  const prev = () => setCurrentStepIndex((s) => Math.max(0, s - 1));

  const onSubmit = async (data: FormData) => {
    try {
      const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
      if (!webhookUrl) {
        toast({ title: "Error", description: "Missing Webhook URL configuration." });
        return;
      }

      // --- 2. CALCULATIONS ---

      // A. Total Hours
      const calculatedTotalHours = data.lessons.reduce((sum, item) => sum + (item.totalHours || 0), 0);

      // B. Schedule Text
      const combinedSchedule = data.lessons
        .map(l => `${l.type} (${l.totalHours}h): ${l.schedule}`)
        .join("\n");

      // C. Types and Formats
      const combinedTypes = data.lessons.map(l => l.type).join(" + ");
      const combinedFormats = data.lessons.map(l => l.format).join(" / ");

      // D. Generate Excel Payment String
      // Format: "2026-01-01 100; 2026-02-01 200;"
      const paymentString = data.payments
        .map((p: any) => `${p.date}: ${p.amount} CHF`)
        .join(";  ");

      // --- 3. PREPARE PAYLOAD ---
      const payload = {
        body: {
          ...data,
          
          // New Calculated Fields
          calculatedTotalValue: liveTotalValue, 
          paymentPlanString: paymentString, // <--- For Excel

          // Mapped Fields
          totalHours: calculatedTotalHours,
          scheduleText: combinedSchedule,
          lessonType: combinedTypes,
          hoursPerLesson: combinedFormats,

          // Backward Compatibility (Map array to old fields for PDF)
          pay1Date: data.payments[0]?.date || "",
          pay1Amount: data.payments[0]?.amount || 0,
          pay2Date: data.payments[1]?.date || "",
          pay2Amount: data.payments[1]?.amount || "",
          pay3Date: data.payments[2]?.date || "",
          pay3Amount: data.payments[2]?.amount || "",

          pricePerHour: data.lessons[0].pricePerHour,
          level: Array.isArray(data.level) ? data.level.join(", ") : data.level,
          
          address: `${data.addrStreet} ${data.addrHouse}${data.addrApt ? ', Apt ' + data.addrApt : ''}\n${data.addrZip} ${data.addrCity}\n${data.addrState}, ${data.addrCountry}`,
          
          companyAddress: data.clientType === 'business' 
            ? `${data.compStreet} ${data.compHouse}${data.compApt ? ', Apt ' + data.compApt : ''}\n${data.compZip} ${data.compCity}\n${data.compState}, ${data.compCountry}`
            : "",
          
          contractDate: data.contractDate.toString(),
        }
      };

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error();

      toast({
        title: "Success! 🚀",
        description: `Contract generated. Total Value: ${liveTotalValue} CHF`,
      });
      
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Submission failed",
        description: "Could not reach n8n.",
      });
    }
  };

  if (!mounted) return null; 

  const currentStepId = steps[currentStepIndex]?.id;

  return (
    <Card className="w-full max-w-xl mx-auto rounded-2xl shadow-sm border border-slate-200 bg-white my-8">
      <CardHeader className="pb-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">
            Step {currentStepIndex + 1} of {steps.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-1 rounded-full flex-1 transition-colors ${
                currentStepIndex >= index ? 'bg-primary' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>

        <div className="pt-2">
          <CardTitle className="text-xl font-semibold">{steps[currentStepIndex].title}</CardTitle>
          <CardDescription className="text-sm text-slate-500">{steps[currentStepIndex].description}</CardDescription>
        </div>
      </CardHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, (errors) => console.log("❌ FORM ERRORS:", errors))}>
          <CardContent className="min-h-[400px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStepIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="space-y-5 pb-4"
              >
                {/* STEP 1 */}
                {currentStepId === 'settings' && (
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
                {currentStepId === 'client' && (
                  <div className="space-y-5">
                    <TextField form={form} name="firstName" label="First Name" />
                    <TextField form={form} name="lastName" label="Last Name" />
                    <TextField form={form} name="email" label="Email" type="email" />
                    <PhoneField form={form} name="phone" label="Phone" />
                    <AddressGroup form={form} prefix="addr" label="Private Address" />
                  </div>
                )}

                {/* STEP 2.5 (BUSINESS) */}
                {currentStepId === 'company' && (
                  <div className="space-y-5">
                    <TextField form={form} name="companyName" label="Company Name" />
                    <AddressGroup form={form} prefix="comp" label="Company Address" />
                  </div>
                )}

                {/* STEP 3 */}
                {currentStepId === 'course' && (
                  <div className="space-y-5">
                    <SelectField form={form} name="courseLang" label="Course Language" items={["German", "Spanish"]} />
                    
                    <MultiSelectField 
                      form={form} 
                      name="level" 
                      label="Level" 
                      items={["A1", "A2", "B1", "B2", "C1", "C2"]} 
                    />

                    <LessonList form={form} />

                    <div className="pt-4 border-t">
                      <NumberField form={form} name="discount" label="Global Discount %" />
                      <LiveTotalSummary form={form} />
                    </div>
                  </div>
                )}

                {/* STEP 4 */}
                {currentStepId === 'billing' && (
                  <div className="space-y-5">
                    <DateField form={form} name="courseStart" label="Course Start" />
                    <DateField form={form} name="courseEnd" label="Course End" />
                    <DateField form={form} name="validUntil" label="Valid Until" />

                    {/* 👇 NEW DYNAMIC PAYMENT PLANNER 👇 */}
                    <div className="space-y-4 pt-4 border-t">
                       <PaymentBuilder form={form} calculatedTotal={liveTotalValue} />
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </CardContent>
          <CardFooter className="bg-white p-6 border-t flex gap-3">
              <Button type="button" variant="outline" className="flex-1 h-11" onClick={prev} disabled={currentStepIndex === 0}>
                Back
              </Button>
              {currentStepIndex === steps.length - 1 ? (
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

function getFieldsForStep(stepIndex: number, steps: any[], values: FormData): FieldPath<FormData>[] {
  const stepId = steps[stepIndex]?.id;
  switch (stepId) {
    case 'settings':
      return ["language", "source", "contractDate", "clientType"];
    case 'client':
      return [
        "firstName", "lastName", "email", "phone", 
        "addrStreet", "addrHouse", "addrCity", "addrZip", "addrState", "addrCountry"
      ];
    case 'company':
      // This will only be triggered if it's a business client due to dynamic steps
      return ["companyName", "compStreet", "compHouse", "compCity", "compZip", "compState", "compCountry"];
    case 'course':
      return ["courseLang", "level", "program", "discount", "lessons"];
    case 'billing':
      // 👇 Validate the NEW payments array
      return ["courseStart", "courseEnd", "validUntil", "payments"];
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
          <div className="grid grid-cols-3 gap-4"> 
            {items.map((item) => (
              <FormField
                key={item}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <label className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors">
                      <FormControl>
                        <Checkbox
                          checked={(field.value as string[])?.includes(item)}
                          onCheckedChange={(checked) => {
                            const current = (field.value as string[]) || [];
                            return checked ? field.onChange([...current, item]) : field.onChange(current.filter((value) => value !== item));
                          }}
                        />
                      </FormControl>
                      <span className="font-normal text-sm">{item}</span>
                    </label>
                  </FormItem>
                )}
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
      render={({ field, fieldState }) => (
        <FormItem>
          <FormLabel className="text-sm font-medium text-slate-700">{label}</FormLabel>
          <FormControl>
            <div className={cn(
                "flex h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                fieldState.error && "border-destructive"
              )}>
              <PhoneInput
                placeholder="Enter phone number"
                value={field.value as string}
                onChange={field.onChange}
                defaultCountry="CH"
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
  const countryOptions = useMemo(() => countryList().getLabels(), []);

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <p className="text-sm font-semibold text-slate-900">{label}</p>
      <div className="grid grid-cols-6 gap-3">
        <div className="col-span-4"><TextField form={form} name={`${prefix}Street` as any} label="Street" /></div>
        <div className="col-span-2"><TextField form={form} name={`${prefix}House` as any} label="No." /></div>
        <div className="col-span-2"><TextField form={form} name={`${prefix}Apt` as any} label="Apt (Opt)" /></div>
        <div className="col-span-4"><TextField form={form} name={`${prefix}City` as any} label="City" /></div>
        <div className="col-span-2"><TextField form={form} name={`${prefix}Zip` as any} label="Zip" /></div>
        <div className="col-span-2"><TextField form={form} name={`${prefix}State` as any} label="State" /></div>
        <div className="col-span-4"><SelectField form={form} name={`${prefix}Country` as any} label="Country" items={countryOptions} /></div>
      </div>
    </div>
  );
}

/* ------------------ LESSONS COMPONENT ------------------ */

const timeToMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

function ScheduleBuilder({ form, index }: { form: UseFormReturn<FormData>; index: number }) {
  const [day, setDay] = useState("Monday");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [error, setError] = useState<{ msg: string | null; fields: Array<'start' | 'end'> }>({ msg: null, fields: [] });

  const currentScheduleStr = form.watch(`lessons.${index}.schedule`) || "";
  
  const slots = currentScheduleStr ? currentScheduleStr.split(", ").filter(Boolean).map(s => {
    const [d, times] = s.split(" ");
    const [start, end] = times.split("-");
    return { day: d, start, end };
  }) : [];

  const addSlot = () => {
    setError({ msg: null, fields: [] });
    if (!startTime && !endTime) return setError({ msg: "Enter start and end times.", fields: ['start', 'end'] });
    if (!startTime) return setError({ msg: "Enter a start time.", fields: ['start'] });
    if (!endTime) return setError({ msg: "Enter an end time.", fields: ['end'] });

    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      return setError({ msg: "End time must be after start.", fields: ['start', 'end'] });
    }

    const newStart = timeToMinutes(startTime);
    const newEnd = timeToMinutes(endTime);

    const hasOverlap = slots.some(slot => {
      if (slot.day !== day) return false;
      const existStart = timeToMinutes(slot.start);
      const existEnd = timeToMinutes(slot.end);
      return newStart < existEnd && newEnd > existStart;
    });

    if (hasOverlap) {
      return setError({ msg: "Time overlaps with an existing slot.", fields: ['start', 'end'] });
    }

    const newSlotStr = `${day} ${startTime}-${endTime}`;
    const newSchedule = currentScheduleStr ? `${currentScheduleStr}, ${newSlotStr}` : newSlotStr;
    
    form.setValue(`lessons.${index}.schedule`, newSchedule, { shouldValidate: true });
    setStartTime("");
    setEndTime("");
  };

  const removeSlot = (slotIndex: number) => {
    const newSlots = slots.filter((_, i) => i !== slotIndex);
    const newString = newSlots.map(s => `${s.day} ${s.start}-${s.end}`).join(", ");
    form.setValue(`lessons.${index}.schedule`, newString);
  };

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
      <FormLabel className="text-sm font-medium text-slate-700">Schedule Slots</FormLabel>
      <div className="flex flex-wrap gap-2 mb-2">
        {slots.map((slot, i) => (
          <div key={i} className="flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-700 border border-blue-100">
            <span>{slot.day.slice(0,3)} {slot.start}-{slot.end}</span>
            <button type="button" onClick={() => removeSlot(i)} className="ml-1 text-blue-400 hover:text-red-500 font-bold">×</button>
          </div>
        ))}
        {slots.length === 0 && <span className="text-xs text-slate-400 italic">No slots added yet.</span>}
      </div>
      <div className="flex gap-2 items-end">
        <div className="flex-1">
           <label className="text-[10px] text-slate-500 uppercase font-bold">Day</label>
           <select className="h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm" value={day} onChange={e => setDay(e.target.value)}>
             {days.map(d => <option key={d} value={d}>{d}</option>)}
           </select>
        </div>
        <div className="w-24">
           <label className="text-[10px] text-slate-500 uppercase font-bold">Start</label>
           <Input type="time" className={cn("h-9", error.fields.includes('start') && "border-destructive focus-visible:ring-destructive")} value={startTime} onChange={e => setStartTime(e.target.value)} />
        </div>
        <div className="w-24">
           <label className="text-[10px] text-slate-500 uppercase font-bold">End</label>
           <Input type="time" className={cn("h-9", error.fields.includes('end') && "border-destructive focus-visible:ring-destructive")} value={endTime} onChange={e => setEndTime(e.target.value)} />
        </div>
        <Button type="button" size="sm" onClick={addSlot} className="h-9 px-3 bg-slate-900 text-white hover:bg-slate-800">+</Button>
      </div>
      {error.msg && <p className="text-xs text-red-500 font-medium mt-1">{error.msg}</p>}
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
              <Button type="button" variant="destructive" size="sm" onClick={() => remove(index)}>Remove</Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SelectField form={form} name={`lessons.${index}.type` as any} label="Type" items={["Online Lessons", "Live Lessons"]} />
            <SelectField form={form} name={`lessons.${index}.format` as any} label="Format (Min)" items={["45", "60", "90", "120"]} />
            <NumberField form={form} name={`lessons.${index}.totalHours` as any} label="Total Hours" />
            <NumberField form={form} name={`lessons.${index}.pricePerHour` as any} label="Price/Hr (CHF)" />
            <div className="col-span-2"><ScheduleBuilder form={form} index={index} /></div>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={() => append({ type: "Online Lessons", format: "60", totalHours: 0, pricePerHour: 0, schedule: "" })} className="w-full border-dashed">
        + Add Another Lesson Type
      </Button>
    </div>
  );
}

function LiveTotalSummary({ form }: { form: UseFormReturn<FormData> }) {
  const lessons = useWatch({ control: form.control, name: "lessons" });
  const discount = useWatch({ control: form.control, name: "discount" }) || 0;
  const grossTotal = lessons?.reduce((sum, item) => sum + ((Number(item.totalHours)||0) * (Number(item.pricePerHour)||0)), 0) || 0;
  const discountAmount = (grossTotal * discount) / 100;
  const netTotal = grossTotal - discountAmount;

  if (grossTotal === 0) return null;

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

/* ------------------ NEW PAYMENT BUILDER ------------------ */

function PaymentBuilder({ form, calculatedTotal }: { form: UseFormReturn<FormData>; calculatedTotal: number }) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "payments" as any, // "as any" handles schema disconnects during dev
  });

  const watchedPayments = useWatch({ control: form.control, name: "payments" }) || [];
  const currentSum = watchedPayments.reduce((sum: number, item: any) => sum + (Number(item?.amount) || 0), 0);
  const remaining = calculatedTotal - currentSum;

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-semibold text-slate-900">Payment Plan</h4>
        <div className="text-xs font-mono text-slate-500 text-right">
          <div>Total: {calculatedTotal} CHF</div>
          <div className={Math.abs(remaining) > 0.01 ? "text-red-500 font-bold" : "text-green-600"}>
            Remaining: {remaining.toFixed(2)} CHF
          </div>
        </div>
      </div>

      {fields.map((field, index) => (
        <div key={field.id} className="flex gap-3 items-end">
          <div className="w-10 pt-3 text-xs font-bold text-slate-400">#{index + 1}</div>
          <FormField
            control={form.control}
            name={`payments.${index}.date`}
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel className="text-[10px] uppercase text-slate-500 font-bold">Date</FormLabel>
                <FormControl>
                  <Input type="date" className="h-10 bg-white" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={`payments.${index}.amount`}
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel className="text-[10px] uppercase text-slate-500 font-bold">Amount (CHF)</FormLabel>
                <FormControl>
                  <Input type="number" className="h-10 bg-white" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} value={field.value ?? ''} />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
          {fields.length > 1 && (
            <Button type="button" variant="destructive" size="icon" className="h-10 w-10 shrink-0" onClick={() => remove(index)}>✕</Button>
          )}
        </div>
      ))}

      <Button type="button" variant="outline" onClick={() => append({ date: "", amount: 0 })} className="w-full border-dashed border-slate-300 hover:bg-white text-slate-600">
        + Add Installment
      </Button>
      {Math.abs(remaining) > 0.01 && (
         <p className="text-xs text-center text-amber-600">Note: The sum of installments ({currentSum}) does not match the Total Value ({calculatedTotal}).</p>
      )}
    </div>
  );
}