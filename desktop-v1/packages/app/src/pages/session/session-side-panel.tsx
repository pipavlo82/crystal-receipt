import { For, Match, Show, Switch, createEffect, createMemo, onCleanup, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { createMediaQuery } from "@solid-primitives/media"
import { Tabs } from "@opencode-ai/ui/tabs"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { TooltipKeybind } from "@opencode-ai/ui/tooltip"
import { ResizeHandle } from "@opencode-ai/ui/resize-handle"
import { Mark } from "@opencode-ai/ui/logo"
import { DragDropProvider, DragDropSensors, DragOverlay, SortableProvider, closestCenter } from "@thisbeyond/solid-dnd"
import type { DragEvent } from "@thisbeyond/solid-dnd"
import type { SnapshotFileDiff, VcsFileDiff } from "@opencode-ai/sdk/v2"
import { ConstrainDragYAxis, getDraggableId } from "@/utils/solid-dnd"
import { useDialog } from "@opencode-ai/ui/context/dialog"

import FileTree from "@/components/file-tree"
import { SessionContextUsage } from "@/components/session-context-usage"
import { SessionContextTab, SortableTab, FileVisual } from "@/components/session"
import { useCommand } from "@/context/command"
import { useFile, type SelectedLineRange } from "@/context/file"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { usePlatform } from "@/context/platform"
import { useSettings } from "@/context/settings"
import { useSync } from "@/context/sync"
import { useServerSDK } from "@/context/server-sdk"
import { showToast } from "@opencode-ai/ui/toast"
import { createFileTabListSync } from "@/pages/session/file-tab-scroll"
import { FileTabContent } from "@/pages/session/file-tabs"
import { createOpenSessionFileTab, createSessionTabs, getTabReorderIndex, type Sizing } from "@/pages/session/helpers"
import { DialogReceiptExplorer } from "@/components/dialog-receipt-explorer"
import { setReceiptHandoff, setSessionHandoff, type HandoffEvidence } from "@/pages/session/handoff"
import { copyText } from "@/utils/copy"
import { useSessionLayout } from "@/pages/session/session-layout"

type RenderDiff = (SnapshotFileDiff & { file: string }) | VcsFileDiff

function renderDiff(value: SnapshotFileDiff | VcsFileDiff): value is RenderDiff {
  return typeof value.file === "string"
}

export function SessionSidePanel(props: {
  canReview: () => boolean
  diffs: () => (SnapshotFileDiff | VcsFileDiff)[]
  diffsReady: () => boolean
  empty: () => string
  hasReview: () => boolean
  reviewCount: () => number
  reviewPanel: () => JSX.Element
  activeDiff?: string
  focusReviewDiff: (path: string) => void
  reviewSnap: boolean
  size: Sizing
}) {
  const layout = useLayout()
  const platform = usePlatform()
  const settings = useSettings()
  const sync = useSync()
  const serverSDK = useServerSDK()
  const file = useFile()
  const language = useLanguage()
  const command = useCommand()
  const dialog = useDialog()
  const { sessionKey, tabs, view, params } = useSessionLayout()

  const isDesktop = createMediaQuery("(min-width: 768px)")
  const desktopV2 = () => platform.platform === "desktop" && settings.general.newLayoutDesigns()
  const shown = createMemo(() => (desktopV2() ? settings.general.showFileTree() : true))

  const reviewOpen = createMemo(() => isDesktop() && view().reviewPanel.opened())
  const fileOpen = createMemo(() => isDesktop() && shown() && layout.fileTree.opened())
  const open = createMemo(() => reviewOpen() || fileOpen())
  const reviewTab = createMemo(() => isDesktop())
  const panelWidth = createMemo(() => {
    if (!open()) return "0px"
    if (reviewOpen()) return `calc(100% - ${layout.session.width()}px)`
    return `${layout.fileTree.width()}px`
  })
  const treeWidth = createMemo(() => (fileOpen() ? `${layout.fileTree.width()}px` : "0px"))

  const diffs = createMemo(() => props.diffs().filter(renderDiff))
  const diffFiles = createMemo(() => diffs().map((d) => d.file))
  const kinds = createMemo(() => {
    const merge = (a: "add" | "del" | "mix" | undefined, b: "add" | "del" | "mix") => {
      if (!a) return b
      if (a === b) return a
      return "mix" as const
    }

    const normalize = (p: string) => p.replaceAll("\\\\", "/").replace(/\/+$/, "")

    const out = new Map<string, "add" | "del" | "mix">()
    for (const diff of diffs()) {
      const file = normalize(diff.file)
      const kind = diff.status === "added" ? "add" : diff.status === "deleted" ? "del" : "mix"

      out.set(file, kind)

      const parts = file.split("/")
      for (const [idx] of parts.slice(0, -1).entries()) {
        const dir = parts.slice(0, idx + 1).join("/")
        if (!dir) continue
        out.set(dir, merge(out.get(dir), kind))
      }
    }
    return out
  })

  const empty = (msg: string) => (
    <div class="h-full flex flex-col">
      <div class="h-6 shrink-0" aria-hidden />
      <div class="flex-1 pb-64 flex items-center justify-center text-center">
        <div class="text-12-regular text-text-weak">{msg}</div>
      </div>
    </div>
  )

  const nofiles = createMemo(() => {
    const state = file.tree.state("")
    if (!state?.loaded) return false
    return file.tree.children("").length === 0
  })

  const normalizeTab = (tab: string) => {
    if (!tab.startsWith("file://")) return tab
    return file.tab(tab)
  }

  const openReviewPanel = () => {
    if (!view().reviewPanel.opened()) view().reviewPanel.open()
  }

  const openTab = createOpenSessionFileTab({
    normalizeTab,
    openTab: tabs().open,
    pathFromTab: file.pathFromTab,
    loadFile: file.load,
    openReviewPanel,
    setActive: tabs().setActive,
  })

  const tabState = createSessionTabs({
    tabs,
    pathFromTab: file.pathFromTab,
    normalizeTab,
    review: reviewTab,
    hasReview: props.canReview,
  })
  const contextOpen = tabState.contextOpen
  const openedTabs = tabState.openedTabs
  const activeTab = tabState.activeTab
  const activeFileTab = tabState.activeFileTab

  const fileTreeTab = () => layout.fileTree.tab()

  const setFileTreeTabValue = (value: string) => {
    if (value !== "changes" && value !== "all") return
    layout.fileTree.setTab(value)
  }

  const showAllFiles = () => {
    if (fileTreeTab() !== "changes") return
    layout.fileTree.setTab("all")
  }

  const [store, setStore] = createStore({
    activeDraggable: undefined as string | undefined,
    handoffEvidence: undefined as HandoffEvidence | undefined,
  })

  const receiptSummary = createMemo(() => {
    const evidence = store.handoffEvidence
    const liveChangedFiles = diffFiles()
    const evidenceChangedFiles = evidence?.changes?.files_changed
    return {
      schema: "stealth.session.evidence.v1" as const,
      sessionID: params.id ?? sessionKey(),
      commandCount: evidence?.commands?.length ?? 0,
      changedFiles: evidenceChangedFiles?.length ? evidenceChangedFiles : liveChangedFiles,
      diffSha256: evidence?.changes?.diff_sha256 ?? null,
      reasonCode: evidence ? "EVIDENCE" : "PREVIEW",
    }
  })

  const shortValue = (value: string, head = 10, tail = 4) =>
    value.length > head + tail + 1 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value

  const commandPreview = createMemo(() =>
    (store.handoffEvidence?.commands ?? [])
      .map((item) => (typeof item?.command === "string" ? item.command : undefined))
      .filter((command): command is string => !!command)
      .slice(0, 3),
  )

  const commandDetails = createMemo(() =>
    (store.handoffEvidence?.commands ?? [])
      .map((item) => ({
        command: typeof item?.command === "string" ? item.command : undefined,
        exitCode: typeof item?.exit_code === "number" ? item.exit_code : undefined,
        stdoutSummary: typeof item?.stdout_summary === "string" ? item.stdout_summary : undefined,
      }))
      .filter((item) => !!item.command),
  )

  const changedFilePreview = createMemo(() => receiptSummary().changedFiles.slice(0, 5))
  const fullChangedFiles = createMemo(() => store.handoffEvidence?.changes?.files_changed ?? receiptSummary().changedFiles)
  const diffHashPreview = createMemo(() => {
    const hash = receiptSummary().diffSha256
    return hash ? hash.slice(0, 12) : "none"
  })

  const evidenceJsonPreview = createMemo(() => {
    const evidence = store.handoffEvidence
    return evidence ? JSON.stringify(evidence, null, 2) : ""
  })

  const copyEvidenceJson = () => {
    const value = evidenceJsonPreview()
    if (!value) return
    void copyText(value)
      .then(() => {
        showToast({
          variant: "success",
          icon: "circle-check",
          title: language.t("session.share.copy.copied"),
          description: "Receipt JSON copied to clipboard",
        })
      })
      .catch((error: unknown) => {
        showToast({
          title: language.t("common.requestFailed"),
          description: error instanceof Error ? error.message : String(error),
        })
      })
  }

  const handleDragStart = (event: unknown) => {
    const id = getDraggableId(event)
    if (!id) return
    setStore("activeDraggable", id)
  }

  const handleDragOver = (event: DragEvent) => {
    const { draggable, droppable } = event
    if (!draggable || !droppable) return

    const currentTabs = tabs().all()
    const toIndex = getTabReorderIndex(currentTabs, draggable.id.toString(), droppable.id.toString())
    if (toIndex === undefined) return
    tabs().move(draggable.id.toString(), toIndex)
  }

  const handleDragEnd = () => {
    setStore("activeDraggable", undefined)
  }

  createEffect(() => {
    const sessionID = params.id
    const diffDependency = diffFiles().join("\n")
    void diffDependency
    if (!sessionID) return

    let cancelled = false

    const rawClient = (
      serverSDK.client as unknown as {
        client: {
          get: (input: { url: string; path: { sessionID: string } }) => Promise<{
            data: HandoffEvidence
          }>
        }
      }
    ).client

    void rawClient
      .get({
        url: "/session/{sessionID}/handoff",
        path: { sessionID },
      })
      .then((result) => {
        if (cancelled) return
        setStore("handoffEvidence", result.data)
      })
      .catch((error) => {
        console.debug("[receipt-preview] failed to load handoff evidence", {
          sessionID,
          message: error instanceof Error ? error.message : String(error),
        })
      })

    onCleanup(() => {
      cancelled = true
    })
  })

  createEffect(() => {
    setReceiptHandoff(sessionKey(), receiptSummary())
  })

  createEffect(() => {
    if (!file.ready()) return

    setSessionHandoff(sessionKey(), {
      files: tabs()
        .all()
        .reduce<Record<string, SelectedLineRange | null>>((acc, tab) => {
          const path = file.pathFromTab(tab)
          if (!path) return acc

          const selected = file.selectedLines(path)
          acc[path] =
            selected && typeof selected === "object" && "start" in selected && "end" in selected
              ? (selected as SelectedLineRange)
              : null

          return acc
        }, {}),
    })
  })

  return (
    <Show when={isDesktop() && !(settings.general.newLayoutDesigns() && !params.id)}>
      <aside
        id="review-panel"
        aria-label={language.t("session.panel.reviewAndFiles")}
        aria-hidden={!open()}
        inert={!open()}
        class="relative min-w-0 h-full flex shrink-0 overflow-hidden bg-background-base"
        classList={{
          "pointer-events-none": !open(),
          "transition-[width] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width] motion-reduce:transition-none":
            !props.size.active() && !props.reviewSnap,
        }}
        style={{ width: panelWidth() }}
      >
        <Show when={open()}>
          <div class="size-full flex border-l border-border-weaker-base">
            <div
              aria-hidden={!reviewOpen()}
              inert={!reviewOpen()}
              class="relative min-w-0 h-full flex-1 overflow-hidden bg-background-base"
              classList={{
                "pointer-events-none": !reviewOpen(),
              }}
            >
              <div class="size-full min-w-0 h-full bg-background-base">
                <DragDropProvider
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  collisionDetector={closestCenter}
                >
                  <DragDropSensors />
                  <ConstrainDragYAxis />
                  <Tabs value={activeTab()} onChange={openTab}>
                    <div class="sticky top-0 shrink-0 flex">
                      <Tabs.List
                        ref={(el: HTMLDivElement) => {
                          const stop = createFileTabListSync({ el, contextOpen })
                          onCleanup(stop)
                        }}
                      >
                        <Show when={reviewTab() && props.canReview()}>
                          <Tabs.Trigger value="review">
                            <div class="flex items-center gap-1.5">
                              <div>{language.t("session.tab.review")}</div>
                              <Show when={props.hasReview()}>
                                <div>{props.reviewCount()}</div>
                              </Show>
                            </div>
                          </Tabs.Trigger>
                        </Show>
                        <Show when={contextOpen()}>
                          <Tabs.Trigger
                            value="context"
                            closeButton={
                              <TooltipKeybind
                                title={language.t("common.closeTab")}
                                keybind={command.keybind("tab.close")}
                                placement="bottom"
                                gutter={10}
                              >
                                <IconButton
                                  icon="close-small"
                                  variant="ghost"
                                  class="h-5 w-5"
                                  onClick={() => tabs().close("context")}
                                  aria-label={language.t("common.closeTab")}
                                />
                              </TooltipKeybind>
                            }
                            hideCloseButton
                            onMiddleClick={() => tabs().close("context")}
                          >
                            <div class="flex items-center gap-2">
                              <SessionContextUsage variant="indicator" />
                              <div>{language.t("session.tab.context")}</div>
                            </div>
                          </Tabs.Trigger>
                        </Show>
                        <SortableProvider ids={openedTabs()}>
                          <For each={openedTabs()}>{(tab) => <SortableTab tab={tab} onTabClose={tabs().close} />}</For>
                        </SortableProvider>
                        <div class="bg-background-stronger h-full shrink-0 sticky right-0 z-10 flex items-center justify-center pr-3">
                          <TooltipKeybind
                            title={language.t("command.file.open")}
                            keybind={command.keybind("file.open")}
                            class="flex items-center"
                          >
                            <IconButton
                              icon="plus-small"
                              variant="ghost"
                              iconSize="large"
                              class="!rounded-md"
                              onClick={() => {
                                void import("@/components/dialog-select-file").then((x) => {
                                  dialog.show(() => <x.DialogSelectFile mode="files" onOpenFile={showAllFiles} />)
                                })
                              }}
                              aria-label={language.t("command.file.open")}
                            />
                          </TooltipKeybind>
                        </div>
                      </Tabs.List>
                    </div>

                    <Show when={reviewTab() && props.canReview()}>
                      <Tabs.Content value="review" class="flex flex-col h-full overflow-hidden contain-strict">
                        <Show when={reviewOpen() && activeTab() === "review"}>
                          <div class="shrink-0 mx-3 mt-3 mb-2 rounded-md border border-border-weak-base bg-surface-panel px-3 py-2">
                            <div class="flex items-center justify-between gap-3">
                              <div class="min-w-0">
                                <div class="text-12-semibold text-text-base">Receipt preview</div>
                                <div class="text-11-regular text-text-weak truncate">
                                  schema: {receiptSummary().schema}
                                </div>
                              </div>
                              <div class="shrink-0 rounded-full border border-border-weak-base px-2 py-0.5 text-11-regular text-text-weak">
                                {receiptSummary().reasonCode}
                              </div>
                            </div>

                            <div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-11-regular text-text-weak">
                              <span>session: {shortValue(receiptSummary().sessionID)}</span>
                              <span>diff: {diffHashPreview()}</span>
                              <span>commands: {receiptSummary().commandCount}</span>
                              <span>changed files: {receiptSummary().changedFiles.length}</span>
                            </div>

                            <Show when={commandPreview().length}>
                              <div class="mt-2 space-y-1 text-11-regular text-text-weak">
                                <div class="text-text-base">commands</div>
                                <For each={commandPreview()}>
                                  {(command) => <div class="truncate font-mono">{command}</div>}
                                </For>
                              </div>
                            </Show>

                            <Show when={changedFilePreview().length}>
                              <div class="mt-2 space-y-1 text-11-regular text-text-weak">
                                <div class="text-text-base">changed files</div>
                                <For each={changedFilePreview()}>
                                  {(file) => <div class="truncate font-mono">{file}</div>}
                                </For>
                              </div>
                            </Show>

                            <Show when={store.handoffEvidence}>
                              {(evidence) => (
                                <div class="mt-3 border-t border-border-weak-base pt-2 text-11-regular text-text-weak">
                                  <div class="flex items-center justify-between gap-2">
                                    <div>
                                      <div class="text-text-base">receipt details</div>
                                      <div class="text-10-regular text-text-weak">
                                        Compatible with the ReceiptOS-PQ verifier flow.
                                      </div>
                                    </div>
                                    <div class="flex items-center gap-2">
                                      <button
                                        type="button"
                                        class="rounded border border-border-weak-base px-2 py-0.5 text-11-regular text-text-weak hover:text-text-base"
                                        onClick={() =>
                                          dialog.show(() => (
                                            <DialogReceiptExplorer evidence={evidence()} summary={receiptSummary()} />
                                          ))
                                        }
                                      >
                                        Open receipt
                                      </button>
                                      <button
                                        type="button"
                                        class="rounded border border-border-weak-base px-2 py-0.5 text-11-regular text-text-weak hover:text-text-base"
                                        onClick={copyEvidenceJson}
                                      >
                                        Copy JSON
                                      </button>
                                    </div>
                                  </div>

                                  <div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                                    <span>agent: {evidence().agent?.id ?? "unknown"}</span>
                                    <span>runtime: {evidence().agent?.runtime ?? "unknown"}</span>
                                    <span>commands: {commandDetails().length}</span>
                                    <span>changed files: {fullChangedFiles().length}</span>
                                  </div>
                                </div>
                              )}
                            </Show>
                          </div>
                          {props.reviewPanel()}
                        </Show>
                      </Tabs.Content>
                    </Show>

                    <Tabs.Content value="empty" class="flex flex-col h-full overflow-hidden contain-strict">
                      <Show when={activeTab() === "empty"}>
                        <div class="relative pt-2 flex-1 min-h-0 overflow-hidden">
                          <div class="h-full px-6 pb-42 -mt-4 flex flex-col items-center justify-center text-center gap-6">
                            <Mark class="w-14 opacity-10" />
                            <div class="text-14-regular text-text-weak max-w-56">
                              {language.t("session.files.selectToOpen")}
                            </div>
                          </div>
                        </div>
                      </Show>
                    </Tabs.Content>

                    <Show when={contextOpen()}>
                      <Tabs.Content value="context" class="flex flex-col h-full overflow-hidden contain-strict">
                        <Show when={activeTab() === "context"}>
                          <div class="relative pt-2 flex-1 min-h-0 overflow-hidden">
                            <SessionContextTab />
                          </div>
                        </Show>
                      </Tabs.Content>
                    </Show>

                    <Show when={activeFileTab()} keyed>
                      {(tab) => <FileTabContent tab={tab} />}
                    </Show>
                  </Tabs>
                  <DragOverlay>
                    <Show when={store.activeDraggable} keyed>
                      {(tab) => {
                        const path = file.pathFromTab(tab)
                        return (
                          <div data-component="tabs-drag-preview">
                            <Show when={path}>{(p) => <FileVisual active path={p()} />}</Show>
                          </div>
                        )
                      }}
                    </Show>
                  </DragOverlay>
                </DragDropProvider>
              </div>
            </div>

            <Show when={shown()}>
              <div
                id="file-tree-panel"
                aria-hidden={!fileOpen()}
                inert={!fileOpen()}
                class="relative min-w-0 h-full shrink-0 overflow-hidden"
                classList={{
                  "pointer-events-none": !fileOpen(),
                  "transition-[width] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width] motion-reduce:transition-none":
                    !props.size.active(),
                }}
                style={{ width: treeWidth() }}
              >
                <div
                  class="h-full flex flex-col overflow-hidden group/filetree"
                  classList={{ "border-l border-border-weaker-base": reviewOpen() }}
                >
                  <Tabs
                    variant="pill"
                    value={fileTreeTab()}
                    onChange={setFileTreeTabValue}
                    class="h-full"
                    data-scope="filetree"
                  >
                    <Tabs.List>
                      <Tabs.Trigger value="changes" class="flex-1" classes={{ button: "w-full" }}>
                        {props.reviewCount()}{" "}
                        {language.t(
                          props.reviewCount() === 1 ? "session.review.change.one" : "session.review.change.other",
                        )}
                      </Tabs.Trigger>
                      <Tabs.Trigger value="all" class="flex-1" classes={{ button: "w-full" }}>
                        {language.t("session.files.all")}
                      </Tabs.Trigger>
                    </Tabs.List>
                    <Tabs.Content value="changes" class="bg-background-stronger px-3 py-0">
                      <Switch>
                        <Match when={props.hasReview() || !props.diffsReady()}>
                          <Show
                            when={props.diffsReady()}
                            fallback={
                              <div class="px-2 py-2 text-12-regular text-text-weak">
                                {language.t("common.loading")}
                                {language.t("common.loading.ellipsis")}
                              </div>
                            }
                          >
                            <FileTree
                              path=""
                              class="pt-3"
                              allowed={diffFiles()}
                              kinds={kinds()}
                              draggable={false}
                              active={props.activeDiff}
                              onFileClick={(node) => props.focusReviewDiff(node.path)}
                            />
                          </Show>
                        </Match>
                      </Switch>
                    </Tabs.Content>
                    <Tabs.Content value="all" class="bg-background-stronger px-3 py-0">
                      <Switch>
                        <Match when={nofiles()}>{empty(language.t("session.files.empty"))}</Match>
                        <Match when={true}>
                          <FileTree
                            path=""
                            class="pt-3"
                            modified={diffFiles()}
                            kinds={kinds()}
                            onFileClick={(node) => openTab(file.tab(node.path))}
                          />
                        </Match>
                      </Switch>
                    </Tabs.Content>
                  </Tabs>
                </div>
                <Show when={fileOpen()}>
                  <div onPointerDown={() => props.size.start()}>
                    <ResizeHandle
                      direction="horizontal"
                      edge="start"
                      size={layout.fileTree.width()}
                      min={200}
                      max={480}
                      onResize={(width) => {
                        props.size.touch()
                        layout.fileTree.resize(width)
                      }}
                    />
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        </Show>
      </aside>
    </Show>
  )
}
