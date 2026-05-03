# Graph Report - frontend  (2026-05-03)

## Corpus Check
- 272 files · ~626,222 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 676 nodes · 511 edges · 27 communities detected
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 60 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]

## God Nodes (most connected - your core abstractions)
1. `Inworld` - 20 edges
2. `getCurrentUser()` - 15 edges
3. `InworldConnection` - 9 edges
4. `InworldConnection` - 9 edges
5. `Inworld` - 8 edges
6. `getAuthenticatedUserId()` - 7 edges
7. `sendOtp()` - 6 edges
8. `ContextCompressor` - 6 edges
9. `recordVoiceSession()` - 5 edges
10. `POST()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `refreshUser()` --calls--> `getCurrentUser()`  [INFERRED]
  components\global\chat\ChatInterface.tsx → lib\actions\auth.ts
- `Page()` --calls--> `getCurrentUser()`  [INFERRED]
  app\page.tsx → lib\actions\auth.ts
- `AuthLayout()` --calls--> `getCurrentUser()`  [INFERRED]
  app\(auth)\layout.tsx → lib\actions\auth.ts
- `POST()` --calls--> `getAuthenticatedUserId()`  [INFERRED]
  app\api\chat\route.ts → lib\actions\auth.ts
- `GET()` --calls--> `getCurrentUser()`  [INFERRED]
  app\api\gemini-token\route.ts → lib\actions\auth.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (14): createChatSession(), deleteChatSession(), getChatMessages(), getChatSessions(), updateChatSessionTitle(), handleDelete(), handleSaveEdit(), ensureChatSession() (+6 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (18): completeSignup(), getCurrentUser(), getNextMidnight(), isAuthenticated(), setSessionCookie(), signIn(), signOut(), signUp() (+10 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (11): forgotPassword(), initiateSignup(), resendOtpAction(), sendOtp(), getUserTransactions(), processDeposit(), handleAddFunds(), TransactionList() (+3 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (16): getAuthenticatedUserId(), deleteTranscriptionRecord(), getTranscriptionRecord(), getTranscriptions(), saveTranscriptionRecord(), transcribeDocument(), checkUserCanSend(), getDateRange() (+8 more)

### Community 4 - "Community 4"
Cohesion: 0.15
Nodes (1): Inworld

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (10): deleteNotification(), getNotifications(), markAllAsRead(), markAsRead(), markAsUnread(), handleDelete(), handleMarkAllRead(), handleMarkRead() (+2 more)

### Community 6 - "Community 6"
Cohesion: 0.18
Nodes (2): Inworld, InworldConnection

### Community 7 - "Community 7"
Cohesion: 0.18
Nodes (2): Inworld, InworldConnection

### Community 8 - "Community 8"
Cohesion: 0.23
Nodes (7): createNotification(), recordVoiceSession(), recordVoiceUsageAndDeduct(), summarizeConversation(), SUMMARIZE_TRANSCRIPT_PROMPT(), sendPushToUser(), POST()

### Community 9 - "Community 9"
Cohesion: 0.24
Nodes (5): handleSendClick(), getFCMToken(), getMessagingInstance(), logAnalyticsEvent(), onForegroundMessage()

### Community 10 - "Community 10"
Cohesion: 0.22
Nodes (2): SidebarMenuButton(), useSidebar()

### Community 11 - "Community 11"
Cohesion: 0.33
Nodes (5): cleanupSession(), finalizeRecording(), groupIntoSegments(), readAllChunks(), resampleToFloat32()

### Community 12 - "Community 12"
Cohesion: 0.31
Nodes (1): Inworld

### Community 13 - "Community 13"
Cohesion: 0.29
Nodes (4): checkRootCollection(), getDateRange(), getVoiceSessions(), UserPage()

### Community 14 - "Community 14"
Cohesion: 0.25
Nodes (2): createSupportTicket(), handleSubmit()

### Community 16 - "Community 16"
Cohesion: 0.33
Nodes (1): ContextCompressor

### Community 18 - "Community 18"
Cohesion: 0.33
Nodes (3): useConversationRecorder(), useGeminiLive(), GeminiVoiceConnection()

### Community 19 - "Community 19"
Cohesion: 0.5
Nodes (2): handleCreateComplaint(), handleSubmit()

### Community 21 - "Community 21"
Cohesion: 0.4
Nodes (1): PCMPlayerProcessor

### Community 22 - "Community 22"
Cohesion: 0.6
Nodes (3): checkApiKey(), main(), websocketTts()

### Community 31 - "Community 31"
Cohesion: 0.83
Nodes (3): lerp(), lerpColors(), lerpRGB()

### Community 33 - "Community 33"
Cohesion: 0.5
Nodes (2): FCMProvider(), useFCMPushNotifications()

### Community 35 - "Community 35"
Cohesion: 0.5
Nodes (1): PCMProcessor

### Community 36 - "Community 36"
Cohesion: 0.5
Nodes (1): PCMProcessor

### Community 38 - "Community 38"
Cohesion: 0.5
Nodes (2): ThemeInitializer(), useThemeInitializer()

### Community 39 - "Community 39"
Cohesion: 0.5
Nodes (2): fetch(), main()

### Community 40 - "Community 40"
Cohesion: 0.5
Nodes (1): PCMProcessor

## Knowledge Gaps
- **Thin community `Community 4`** (21 nodes): `Inworld`, `.attachListeners()`, `.close()`, `.connect()`, `.constructor()`, `.createConnection()`, `.createConnectionWithRetry()`, `.createContext()`, `.debug()`, `.destroy()`, `.ensureConnected()`, `.extractContextId()`, `.extractSentences()`, `.flush()`, `.onAudio()`, `.push()`, `.reconnect()`, `.resetContext()`, `.sendText()`, `.waitForContext()`, `inworld.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 6`** (13 nodes): `Inworld`, `.connect()`, `.constructor()`, `InworldConnection`, `.cleanup()`, `.close()`, `.connect()`, `.constructor()`, `.handleMessage()`, `.speak()`, `.splitSentences()`, `.synthesizeStreaming()`, `inworld2.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 7`** (13 nodes): `Inworld`, `.connect()`, `.constructor()`, `InworldConnection`, `.cleanup()`, `.close()`, `.closeContext()`, `.connect()`, `.constructor()`, `.ensureConnection()`, `.handleMessage()`, `.synthesizeStreaming()`, `inworld3.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 10`** (10 nodes): `sidebar.tsx`, `cn()`, `handleKeyDown()`, `SidebarFooter()`, `SidebarHeader()`, `SidebarMenu()`, `SidebarMenuButton()`, `SidebarMenuItem()`, `SidebarSeparator()`, `useSidebar()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (9 nodes): `Inworld`, `.cleanup()`, `.close()`, `.connect()`, `.constructor()`, `.handleMessage()`, `.splitSentences()`, `.synthesize()`, `inworld5.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (8 nodes): `createSupportTicket()`, `getHelpArticles()`, `getUserSupportTickets()`, `Support.tsx`, `support.ts`, `getStatusColor()`, `getStatusIcon()`, `handleSubmit()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (7 nodes): `ContextCompressor`, `.addTurn()`, `.clear()`, `.constructor()`, `.formatHistory()`, `.getOptimizedContext()`, `compressor.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (5 nodes): `getStatusColor()`, `getStatusIcon()`, `handleCreateComplaint()`, `handleSubmit()`, `Support.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (5 nodes): `PCMPlayerProcessor`, `.constructor()`, `._enqueue()`, `.process()`, `pcm-player-processor.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (4 nodes): `FCMProvider.tsx`, `FCMProvider()`, `use-fcm-push-notifications.ts`, `useFCMPushNotifications()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (4 nodes): `PCMProcessor`, `.constructor()`, `.process()`, `pcm-processor.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (4 nodes): `PCMProcessor`, `.constructor()`, `.process()`, `pcm-recorder-processor.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (4 nodes): `ThemeInitializer.tsx`, `ThemeInitializer()`, `theme.ts`, `useThemeInitializer()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (4 nodes): `fetch()`, `client.ts`, `main()`, `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (4 nodes): `pcm-processor.js`, `PCMProcessor`, `.constructor()`, `.process()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getCurrentUser()` connect `Community 1` to `Community 0`, `Community 13`, `Community 5`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `NotificationPage()` connect `Community 5` to `Community 1`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Are the 13 inferred relationships involving `getCurrentUser()` (e.g. with `Page()` and `AuthLayout()`) actually correct?**
  _`getCurrentUser()` has 13 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._