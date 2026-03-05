---
name: shadcn
description: "A comprehensive guide to using shadcn components with React/Next.js using Bun."
---

# shadcn/ui — Complete Guide

shadcn/ui is a collection of re-usable components that you can copy and paste into your apps. It is NOT a component library. It's a collection of components that you own and can modify to suit your needs.

## 1. Installation & Setup

Before installing shadcn, ensure you have a React or Next.js project with **Tailwind CSS** configured.

### Using Bun to Initialize

Run the following command to initialize shadcn in your project:

```bash
bunx shadcn@latest init
```

During initialization, you will be asked several questions to configure `components.json`:

- **Style:** New York (Recommended) or Default.
- **Base Color:** Slate, Gray, Zinc, etc.
- **CSS Variables:** Yes/No (Yes allows easy theming).

---

## 2. General Usage

### Adding Components

Instead of installing a massive npm package, you add individual components as needed. This keeps your bundle small and gives you full control over the code.

```bash
bunx shadcn@latest add [component-name]
```

Example:

```bash
bunx shadcn@latest add button
```

This will create a `components/ui/button.tsx` file in your project.

### Using Components

Once added, simply import and use them like any other React component:

```tsx
import { Button } from "@/components/ui/button";

export default function App() {
  return <Button>Click me</Button>;
}
```

---

## 3. Theming & Customization

shadcn uses CSS variables for theming, usually defined in your `globals.css`.

### Modifying Colors

Update the variables in `:root` or `.dark` classes:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  --primary-foreground: 210 40% 98%;
  --radius: 0.5rem;
}
```

### Customizing Components

Since the component code is in your project (`components/ui/`), you can directly edit the JSX and Tailwind classes to change behavior or style permanently.

---

## 4. Components Reference

Here is a guide for the most common shadcn components. All installation commands use **Bun**.

### Accordion

A vertically stacked set of interactive headings that each reveal a section of content.

**Installation:**

```bash
bunx shadcn@latest add accordion
```

**Usage:**

```tsx
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function AccordionDemo() {
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="item-1">
        <AccordionTrigger>Is it accessible?</AccordionTrigger>
        <AccordionContent>
          Yes, it follows the WAI-ARIA pattern.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
```

### Alert

Displays a brief, important message in a way that attracts attention without interrupting the user's task.

**Installation:**

```bash
bunx shadcn@latest add alert
```

**Usage:**

```tsx
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function AlertDemo() {
  return (
    <Alert>
      <AlertTitle>Heads up!</AlertTitle>
      <AlertDescription>
        You can add items to your library now.
      </AlertDescription>
    </Alert>
  );
}
```

### Alert Dialog

A modal dialog that interrupts the user with important content and expects a response.

**Installation:**

```bash
bunx shadcn@latest add alert-dialog
```

**Usage:**

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function AlertDialogDemo() {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline">Delete Account</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

### Avatar

An image element with a fallback for representing the user.

**Installation:**

```bash
bunx shadcn@latest add avatar
```

**Usage:**

```tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function AvatarDemo() {
  return (
    <Avatar>
      <AvatarImage src="https://github.com/shadcn.png" />
      <AvatarFallback>CN</AvatarFallback>
    </Avatar>
  );
}
```

### Badge

Displays a small Amount of information or a status.

**Installation:**

```bash
bunx shadcn@latest add badge
```

**Usage:**

```tsx
import { Badge } from "@/components/ui/badge";

export function BadgeDemo() {
  return <Badge variant="outline">Badge</Badge>;
}
```

### Button

Displays a button or a component that looks like a button.

**Installation:**

```bash
bunx shadcn@latest add button
```

**Usage:**

```tsx
import { Button } from "@/components/ui/button";

export function ButtonDemo() {
  return <Button variant="destructive">Delete</Button>;
}
```

### Card

A flexible and extensible content container.

**Installation:**

```bash
bunx shadcn@latest add card
```

**Usage:**

```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function CardDemo() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card Description</CardDescription>
      </AlertDescription>
      <CardContent>
        <p>Card Content</p>
      </CardContent>
      <CardFooter>
        <p>Card Footer</p>
      </CardFooter>
    </Card>
  )
}
```

### Checkbox

A control that allows the user to select one or more options from a set.

**Installation:**

```bash
bunx shadcn@latest add checkbox
```

**Usage:**

```tsx
import { Checkbox } from "@/components/ui/checkbox";

export function CheckboxDemo() {
  return (
    <div className="flex items-center space-x-2">
      <Checkbox id="terms" />
      <label htmlFor="terms">Accept terms and conditions</label>
    </div>
  );
}
```

### Dialog

A window overlaid on either the primary window or another dialog window, rendering the content underneath inert.

**Installation:**

```bash
bunx shadcn@latest add dialog
```

**Usage:**

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function DialogDemo() {
  return (
    <Dialog>
      <DialogTrigger>Open</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogDescription>This is a permanent action.</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
```

### Dropdown Menu

Displays a list of options to the user — triggered by a button, etc.

**Installation:**

```bash
bunx shadcn@latest add dropdown-menu
```

**Usage:**

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function DropdownMenuDemo() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Open</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem>Billing</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Input

A basic text input field.

**Installation:**

```bash
bunx shadcn@latest add input
```

**Usage:**

```tsx
import { Input } from "@/components/ui/input";

export function InputDemo() {
  return <Input type="email" placeholder="Email" />;
}
```

### Label

Renders an accessible label associated with a form control.

**Installation:**

```bash
bunx shadcn@latest add label
```

**Usage:**

```tsx
import { Label } from "@/components/ui/label";

export function LabelDemo() {
  return <Label htmlFor="email">Your email address</Label>;
}
```

### Popover

Displays rich content in a portal, triggered by a button.

**Installation:**

```bash
bunx shadcn@latest add popover
```

**Usage:**

```tsx
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function PopoverDemo() {
  return (
    <Popover>
      <PopoverTrigger>Open popover</PopoverTrigger>
      <PopoverContent>Place content here.</PopoverContent>
    </Popover>
  );
}
```

### Select

Displays a list of options for the user to pick from—triggered by a button.

**Installation:**

```bash
bunx shadcn@latest add select
```

**Usage:**

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SelectDemo() {
  return (
    <Select>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Theme" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="light">Light</SelectItem>
        <SelectItem value="dark">Dark</SelectItem>
        <SelectItem value="system">System</SelectItem>
      </SelectContent>
    </Select>
  );
}
```

### Separator

Visually or semantically separates content.

**Installation:**

```bash
bunx shadcn@latest add separator
```

**Usage:**

```tsx
import { Separator } from "@/components/ui/separator";

export function SeparatorDemo() {
  return <Separator className="my-4" />;
}
```

### Sheet

Extends the Dialog component to display content that complements the main content of the screen.

**Installation:**

```bash
bunx shadcn@latest add sheet
```

**Usage:**

```tsx
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function SheetDemo() {
  return (
    <Sheet>
      <SheetTrigger>Open</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit Profile</SheetTitle>
          <SheetDescription>
            Make changes to your profile here.
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  );
}
```

### Skeleton

Used to show a placeholder while content is loading.

**Installation:**

```bash
bunx shadcn@latest add skeleton
```

**Usage:**

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonDemo() {
  return (
    <div className="flex items-center space-x-4">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-[250px]" />
        <Skeleton className="h-4 w-[200px]" />
      </div>
    </div>
  );
}
```

### Spinner / Loading

shadcn doesn't have a specific "Spinner" component because it's usually just an icon with an animation. The standard approach is using `lucide-react`.

**Usage:**

```tsx
import { Loader2 } from "lucide-react";

export function Spinner() {
  return <Loader2 className="h-4 w-4 animate-spin" />;
}
```

### Switch

A control that allows the user to toggle between checked and not checked.

**Installation:**

```bash
bunx shadcn@latest add switch
```

**Usage:**

```tsx
import { Switch } from "@/components/ui/switch";

export function SwitchDemo() {
  return <Switch />;
}
```

### Table

A responsive table component.

**Installation:**

```bash
bunx shadcn@latest add table
```

**Usage:**

```tsx
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function TableDemo() {
  return (
    <Table>
      <TableCaption>A list of your recent invoices.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">Invoice</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Method</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">INV001</TableCell>
          <TableCell>Paid</TableCell>
          <TableCell>Credit Card</TableCell>
          <TableCell className="text-right">$250.00</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
```

### Tabs

A set of layered sections of content, known as tab panels, that are displayed one at a time.

**Installation:**

```bash
bunx shadcn@latest add tabs
```

**Usage:**

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function TabsDemo() {
  return (
    <Tabs defaultValue="account" className="w-[400px]">
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
      </TabsList>
      <TabsContent value="account">
        Make changes to your account here.
      </TabsContent>
      <TabsContent value="password">Change your password here.</TabsContent>
    </Tabs>
  );
}
```

### Textarea

A multi-line text input.

**Installation:**

```bash
bunx shadcn@latest add textarea
```

**Usage:**

```tsx
import { Textarea } from "@/components/ui/textarea";

export function TextareaDemo() {
  return <Textarea placeholder="Type your message here." />;
}
```

### Toast

A succinct message that is displayed temporarily.

**Installation:**

```bash
bunx shadcn@latest add toast
```

**Usage (Step 1 - Add Toaster to Layout):**

```tsx
import { Toaster } from "@/components/ui/toaster";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <main>{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
```

**Usage (Step 2 - Trigger Toast):**

```tsx
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";

export function ToastDemo() {
  const { toast } = useToast();
  return (
    <Button
      onClick={() =>
        toast({
          title: "Scheduled: Catch up",
          description: "Friday, February 10, 2023 at 5:57 PM",
        })
      }
    >
      Show Toast
    </Button>
  );
}
```

### Tooltip

A popup that displays information related to an element when the element receives keyboard focus or the mouse hovers over it.

**Installation:**

```bash
bunx shadcn@latest add tooltip
```

**Usage:**

```tsx
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function TooltipDemo() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>Hover</TooltipTrigger>
        <TooltipContent>
          <p>Add to library</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

### Aspect Ratio

Displays content within a desired ratio.

**Installation:**

```bash
bunx shadcn@latest add aspect-ratio
```

**Usage:**

```tsx
import Image from "next/image";
import { AspectRatio } from "@/components/ui/aspect-ratio";

export function AspectRatioDemo() {
  return (
    <div className="w-[450px]">
      <AspectRatio ratio={16 / 9}>
        <Image src="..." alt="Image" className="rounded-md object-cover" />
      </AspectRatio>
    </div>
  );
}
```

### Calendar

A date picker component.

**Installation:**

```bash
bunx shadcn@latest add calendar
```

**Usage:**

```tsx
import * as React from "react";
import { Calendar } from "@/components/ui/calendar";

export function CalendarDemo() {
  const [date, setDate] = React.useState<Date | undefined>(new Date());

  return (
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
      className="rounded-md border"
    />
  );
}
```

### Carousel

A slideshow component.

**Installation:**

```bash
bunx shadcn@latest add carousel
```

**Usage:**

```tsx
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

export function CarouselDemo() {
  return (
    <Carousel>
      <CarouselContent>
        <CarouselItem>...</CarouselItem>
        <CarouselItem>...</CarouselItem>
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}
```

### Collapsible

An interactive component which can be expanded or collapsed.

**Installation:**

```bash
bunx shadcn@latest add collapsible
```

**Usage:**

```tsx
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function CollapsibleDemo() {
  return (
    <Collapsible>
      <CollapsibleTrigger>Can I use this in my project?</CollapsibleTrigger>
      <CollapsibleContent>
        Yes. Free to use for personal and commercial projects. No attribution
        required.
      </CollapsibleContent>
    </Collapsible>
  );
}
```

### Combobox

Autocomplete input with a list of suggestions.

**Installation:**

```bash
bunx shadcn@latest add command popover
```

**Usage:**

```tsx
"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const frameworks = [
  { value: "next.js", label: "Next.js" },
  { value: "sveltekit", label: "SvelteKit" },
];

export function ComboboxDemo() {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open}>
          {value
            ? frameworks.find((f) => f.value === value)?.label
            : "Select framework..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search framework..." />
          <CommandEmpty>No framework found.</CommandEmpty>
          <CommandGroup>
            {frameworks.map((framework) => (
              <CommandItem
                key={framework.value}
                onSelect={(currentValue) => {
                  setValue(currentValue === value ? "" : currentValue);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === framework.value ? "opacity-100" : "opacity-0",
                  )}
                />
                {framework.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

### Command

Fast, composable, unstyled command menu for React.

**Installation:**

```bash
bunx shadcn@latest add command
```

**Usage:**

```tsx
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

export function CommandDemo() {
  return (
    <Command className="rounded-lg border shadow-md">
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Suggestions">
          <CommandItem>Calendar</CommandItem>
          <CommandItem>Search Emoji</CommandItem>
          <CommandItem>Calculator</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
```

### Context Menu

Displays a menu located at the pointer, triggered by a right-click or a long-press.

**Installation:**

```bash
bunx shadcn@latest add context-menu
```

**Usage:**

```tsx
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export function ContextMenuDemo() {
  return (
    <ContextMenu>
      <ContextMenuTrigger>Right click here</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem>Profile</ContextMenuItem>
        <ContextMenuItem>Billing</ContextMenuItem>
        <ContextMenuItem>Team</ContextMenuItem>
        <ContextMenuItem>Subscription</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
```

### Data Table

Powerful interactive tables built with TanStack Table.

**Installation:**

```bash
bunx shadcn@latest add table
# Also requires TanStack Table
bun add @tanstack/react-table
```

**Usage:**
_Note: Data tables are complex and usually involve creating a separate columns file. See the [official docs](https://ui.shadcn.com/docs/components/data-table) for a full implementation._

### Drawer

A panel that slides out from the edge of the screen.

**Installation:**

```bash
bunx shadcn@latest add drawer
```

**Usage:**

```tsx
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

export function DrawerDemo() {
  return (
    <Drawer>
      <DrawerTrigger>Open</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Are you absolutely sure?</DrawerTitle>
          <DrawerDescription>This action cannot be undone.</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <Button>Submit</Button>
          <DrawerClose>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
```

### Form

Building forms with React Hook Form and Zod.

**Installation:**

```bash
bunx shadcn@latest add form input button
# Also requires react-hook-form and zod
bun add react-hook-form zod @hookform/resolvers
```

**Usage:**

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const formSchema = z.object({
  username: z.string().min(2).max(50),
});

export function ProfileForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="shadcn" {...field} />
              </FormControl>
              <FormDescription>
                This is your public display name.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
```

### Hover Card

For card-like content that is displayed when a user hovers over an element.

**Installation:**

```bash
bunx shadcn@latest add hover-card
```

**Usage:**

```tsx
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

export function HoverCardDemo() {
  return (
    <HoverCard>
      <HoverCardTrigger>Hover me</HoverCardTrigger>
      <HoverCardContent>
        The React Framework – created and maintained by @vercel.
      </HoverCardContent>
    </HoverCard>
  );
}
```

### Input OTP

Accessible one-time password component with copy paste support.

**Installation:**

```bash
bunx shadcn@latest add input-otp
```

**Usage:**

```tsx
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";

export function InputOTPDemo() {
  return (
    <InputOTP maxLength={6}>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  );
}
```

### Menubar

A visually persistent menu common in desktop applications that provides quick access to a consistent set of commands.

**Installation:**

```bash
bunx shadcn@latest add menubar
```

**Usage:**

```tsx
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";

export function MenubarDemo() {
  return (
    <Menubar>
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>
            New Tab <MenubarShortcut>⌘T</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>New Window</MenubarItem>
          <MenubarSeparator />
          <MenubarItem>Share</MenubarItem>
          <MenubarSeparator />
          <MenubarItem>Print</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
```

### Navigation Menu

A collection of links for navigating websites and displaying submenus.

**Installation:**

```bash
bunx shadcn@latest add navigation-menu
```

**Usage:**

```tsx
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

export function NavigationMenuDemo() {
  return (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Item One</NavigationMenuTrigger>
          <NavigationMenuContent>
            <NavigationMenuLink>Link</NavigationMenuLink>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
```

### Pagination

Pagination with page navigation, next, previous and more.

**Installation:**

```bash
bunx shadcn@latest add pagination
```

**Usage:**

```tsx
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export function PaginationDemo() {
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href="#" />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#">1</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationEllipsis />
        </PaginationItem>
        <PaginationItem>
          <PaginationNext href="#" />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
```

### Progress

Displays an indicator showing the completion progress of a task, typically displayed as a progress bar.

**Installation:**

```bash
bunx shadcn@latest add progress
```

**Usage:**

```tsx
import { Progress } from "@/components/ui/progress";

export function ProgressDemo() {
  return <Progress value={33} />;
}
```

### Radio Group

A set of checkable buttons—known as radio buttons—where no more than one button can be checked at a time.

**Installation:**

```bash
bunx shadcn@latest add radio-group
```

**Usage:**

```tsx
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export function RadioGroupDemo() {
  return (
    <RadioGroup defaultValue="option-one">
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option-one" id="option-one" />
        <Label htmlFor="option-one">Option One</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option-two" id="option-two" />
        <Label htmlFor="option-two">Option Two</Label>
      </div>
    </RadioGroup>
  );
}
```

### Resizable

Accessible resizable panel groups and layouts with keyboard support.

**Installation:**

```bash
bunx shadcn@latest add resizable
```

**Usage:**

```tsx
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

export function ResizableDemo() {
  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel>One</ResizablePanel>
      <ResizableHandle />
      <ResizablePanel>Two</ResizablePanel>
    </ResizablePanelGroup>
  );
}
```

### Scroll Area

Augments native scroll functionality for custom, cross-browser styling.

**Installation:**

```bash
bunx shadcn@latest add scroll-area
```

**Usage:**

```tsx
import { ScrollArea } from "@/components/ui/scroll-area";

export function ScrollAreaDemo() {
  return (
    <ScrollArea className="h-[200px] w-[350px] rounded-md border p-4">
      Jokerman was a man of many talents...
    </ScrollArea>
  );
}
```

### Slider

An input where the user selects a value from within a given range.

**Installation:**

```bash
bunx shadcn@latest add slider
```

**Usage:**

```tsx
import { Slider } from "@/components/ui/slider";

export function SliderDemo() {
  return <Slider defaultValue={[33]} max={100} step={1} />;
}
```

### Sonner

An opinionated toast component for React.

**Installation:**

```bash
bunx shadcn@latest add sonner
```

**Usage:**

```tsx
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function SonnerDemo() {
  return (
    <Button variant="outline" onClick={() => toast("Event has been created")}>
      Show Toast
    </Button>
  );
}
```

### Toggle

A two-state button that can be either on or off.

**Installation:**

```bash
bunx shadcn@latest add toggle
```

**Usage:**

```tsx
import { Bold } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";

export function ToggleDemo() {
  return (
    <Toggle aria-label="Toggle italic">
      <Bold className="h-4 w-4" />
    </Toggle>
  );
}
```

### Toggle Group

A set of two-state buttons that can be toggled on or off.

**Installation:**

```bash
bunx shadcn@latest add toggle-group
```

**Usage:**

````tsx
import { Bold, Italic, Underline } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function ToggleGroupDemo() {
  return (
    <ToggleGroup type="multiple">
      <ToggleGroupItem value="bold">
        <Bold className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="italic">
        <Italic className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

### Typography
While there is no `add typography` command, shadcn provides a set of standard Tailwind classes for consistent typography.

**Usage:**
```html
<h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
  The Joke Tax Levied by Yield-Starved Lackeys
</h1>
<h2 className="mt-10 scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight transition-colors first:mt-0">
  The People of the Kingdom
</h2>
<p className="line-height-7 not-first:mt-6">
  The king, seeing how much happier his subjects were, realized the error of his ways.
</p>
<blockquote className="mt-6 border-l-2 pl-6 italic">
  "After all," he said, "everyone enjoys a good joke, especially when it's out of my pocket."
</blockquote>
<code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold">
  @radix-ui/react-alert-dialog
</code>
````

---

## 5. Troubleshooting

- **Module not found:** Ensure you correctly configured path aliases (`@/*`) in `tsconfig.json` or `jsconfig.json`.
- **Styling issues:** Ensure Tailwind CSS is properly set up and `tailwind.config.js` includes the paths to your components.
- **Components not updating:** Remember that you own the code. If you update shadcn via CLI, it might overwrite your changes if not careful (though it usually asks).

---

## 6. Summary of Installation Commands (Bun)

| Component | Command                         |
| --------- | ------------------------------- |
| **All**   | `bunx shadcn@latest add [name]` |
| Button    | `bunx shadcn@latest add button` |
| Input     | `bunx shadcn@latest add input`  |
| Card      | `bunx shadcn@latest add card`   |
| Dialog    | `bunx shadcn@latest add dialog` |
| Form      | `bunx shadcn@latest add form`   |
| Toast     | `bunx shadcn@latest add toast`  |

For more components, visit [ui.shadcn.com](https://ui.shadcn.com).
