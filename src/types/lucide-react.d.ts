declare module 'lucide-react' {
  import { ComponentType, SVGProps } from 'react';
  
  export interface IconProps extends SVGProps<SVGSVGElement> {
    size?: string | number;
    strokeWidth?: string | number;
  }
  
  export type Icon = ComponentType<IconProps>;
  
  export const Plus: Icon;
  export const Edit: Icon;
  export const Trash2: Icon;
  export const Settings: Icon;
  export const CheckCircle: Icon;
  export const XCircle: Icon;
  export const RefreshCw: Icon;
  export const Save: Icon;
  export const X: Icon;
  export const DollarSign: Icon;
  export const Users: Icon;
  export const TrendingUp: Icon;
  export const TrendingDown: Icon;
  export const Calendar: Icon;
  export const CreditCard: Icon;
  export const AlertTriangle: Icon;
  export const Clock: Icon;
  export const Search: Icon;
  
  // Add more icons as needed
  const lucideReact: {
    [key: string]: Icon;
  };
  
  export default lucideReact;
}