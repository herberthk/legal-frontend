import { cn } from "@/lib";
import { Scale } from "lucide-react";

type LogoIconProps = {
  size?: "sm" | "md" | "lg";
  shape?: "square" | "circle" | "rounded";
  iconClass?: string;
  strokeWidth?: number;
};
const LogoIcon = ({
  size = "md",
  shape = "circle",
  iconClass,
  strokeWidth,
}: LogoIconProps) => {
  const sizeMap = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };
  const shapeMap = {
    square: "rounded-none",
    circle: "rounded-full",
    rounded: "rounded-lg",
  };

  const sizePaddingMap = {
    sm: "p-1.5",
    md: "p-2.5",
    lg: "p-3.5",
  };

  const preferedPadding = sizePaddingMap[size];
  const preferedShape = shapeMap[shape];
  const preferedSize = sizeMap[size];
  return (
    <div
      className={cn(
        `bg-linear-to-br from-orange-800 to-indigo-400 shadow-xl shadow-orange-500/20 transform transition-all duration-500 group-hover:scale-110 group-hover:rotate-6`,
        preferedShape,
        preferedPadding,
      )}
    >
      <Scale
        className={cn("text-white", preferedSize, iconClass)}
        strokeWidth={strokeWidth}
      />
    </div>
  );
};

export const LogoText = () => {
  return (
    <div
      className={`text-xl font-black  tracking-tight transition-all duration-300 flex group-data-[collapsible=icon]:hidden`}
    >
      <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-500 to-purple-200">
        Legal
      </span>
      <span className="text-transparent bg-clip-text bg-linear-to-r from-orange-500 to-yellow-500">
        Adviser
      </span>
    </div>
  );
};

type Props = LogoIconProps & {
  className?: string;
  showText?: boolean;
};

const Logo = ({
  className,
  size = "md",
  shape = "circle",
  showText = true,
  iconClass,
  strokeWidth,
}: Props) => {
  return (
    <div
      className={`inline-flex items-center gap-2 cursor-pointer ${className}`}
    >
      <LogoIcon
        size={size}
        shape={shape}
        iconClass={iconClass}
        strokeWidth={strokeWidth}
      />
      {showText && <LogoText />}
    </div>
  );
};

export default Logo;
