declare global {
  type Voice =
    | "Blake"
    | "Luna"
    | "Dennis"
    | "Sarah"
    | "Hana"
    | "Mark"
    | "Hades"
    | "Theodore"
    | "Abby"
    | "Alex"
    | "Amina"
    | "Ashley"
    | "Brian"
    | "Callum"
    | "Carter"
    | "Celeste"
    | "Chloe"
    | "Claire"
    | "Craig"
    | "Darlene"
    | "Deborah"
    | "Derek"
    | "Edward"
    | "Elliot"
    | "Ethan"
    | "Evan"
    | "Evelyn"
    | "Gareth"
    | "Graham"
    | "Grant"
    | "Hamish"
    | "Hank"
    | "Jake"
    | "James"
    | "Jason"
    | "Jessica"
    | "Kayla"
    | "Kelsey"
    | "Lauren"
    | "Liam"
    | "Loretta"
    | "Malcolm"
    | "Marlene"
    | "Miranda"
    | "Mortimer"
    | "Nate"
    | "Oliver"
    | "Pippa"
    | "Pixie"
    | "Ronald"
    | "Rupert"
    | "Serena"
    | "Simon"
    | "Snik"
    | "Tessa"
    | "Timothy"
    | "Tyler"
    | "Veronica"
    | "Victor"
    | "Victoria"
    | "Vinny"
    | "Wendy";

  type VoiceSessionStatus =
    | "idle" // not connected
    | "connecting" // WebSocket opening
    | "open" // connected and active
    | "closed" // cleanly disconnected
    | "error"; // connection error

  type VoiceAudioStatus = "idle" | "playing" | "done";
}

export {};
