import DirectionalTransition from "@/components/global/DirectionalTransition";
import Transcribe from "./Transcribe";

export const maxDuration = 30;

const Page = () => {
  return <DirectionalTransition>
            <Transcribe />
          </DirectionalTransition>
};

export default Page;
