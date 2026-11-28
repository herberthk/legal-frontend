import { pawapay } from "@/sdk";

try {
    const result = await pawapay.msisdn.verify("256779158642");
    console.log('Response',result)
} catch (error) {
 console.log('Error',error)   
}