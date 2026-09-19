"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Issue } from "../lib/types";

type Edge = {
  action: string;
  issue: string;
  kind: Issue["kind"];
  context: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};
type Geometry = { height: number; tops: Record<string, number>; edges: Edge[] };

/** One stretch of the shared timeline. Findings travel with their evidence. */
export default function EvidenceSection({
  id,
  actions,
  findings,
  highlightedIssue,
  focusedAction,
}: {
  id: string;
  actions: ReactNode;
  findings: { issue: Issue; node: ReactNode }[];
  highlightedIssue: string | null;
  focusedAction?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState<Geometry>({
    height: 0,
    tops: {},
    edges: [],
  });
  const [visibleFindings, setVisibleFindings] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    const section = root.current!;
    const observer = new IntersectionObserver(
      (entries) => {
        setVisibleFindings((previous) => {
          const next = new Set(previous);
          for (const entry of entries) {
            const id = (entry.target as HTMLElement).dataset.finding!;
            if (entry.isIntersecting) next.add(id);
            else next.delete(id);
          }
          return next;
        });
        for (const entry of entries) {
          (entry.target as HTMLElement).dataset.inView = String(
            entry.isIntersecting,
          );
        }
      },
      {
        root: section.closest(".evidence-scroll"),
        rootMargin: "0px 0px -16px 0px",
        threshold: 0.05,
      },
    );
    section
      .querySelectorAll(".evidence-finding")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const section = root.current!;
    const actionColumn =
      section.querySelector<HTMLElement>(".section-actions")!;
    const issueColumn =
      section.querySelector<HTMLElement>(".section-findings")!;
    let frame = 0;

    function measure() {
      const bounds = section.getBoundingClientRect();
      const actionElements = new Map(
        Array.from(section.querySelectorAll<HTMLElement>("[data-id]")).map(
          (el) => [
            el.dataset.id!,
            el.querySelector<HTMLElement>(".log-action")!,
          ],
        ),
      );
      // Narrow screens keep the same shared timeline, with each finding below
      // its action group. Text links preserve the relationship there.
      if (
        issueColumn.getBoundingClientRect().left <=
        actionColumn.getBoundingClientRect().left + 1
      ) {
        setGeometry((previous) =>
          previous.height === 0 ? previous : { height: 0, tops: {}, edges: [] },
        );
        return;
      }
      const nodes = findings
        .map(({ issue }) => {
          const element = section.querySelector<HTMLElement>(
            `[data-finding="${issue.id}"]`,
          )!;
          const linked = [...issue.actionIds, ...issue.contextActionIds]
            .map((action) => ({ action, el: actionElements.get(action) }))
            .filter((entry) => entry.el !== undefined);
          const first = Math.min(
            ...linked.map(({ el }) => {
              const rect = el!.getBoundingClientRect();
              return rect.top - bounds.top + rect.height / 2;
            }),
          );
          return { issue, element, linked, target: first };
        })
        .sort((a, b) => a.target - b.target);
      const tops: Record<string, number> = {};
      const edges: Edge[] = [];
      let bottom = 0;
      for (const { issue, element, linked, target } of nodes) {
        const trigger = element.querySelector<HTMLElement>(".issue-trigger")!;
        const triggerHeight = trigger.getBoundingClientRect().height;
        const top = Math.max(0, bottom, target - triggerHeight / 2);
        tops[issue.id] = top;
        bottom = top + element.getBoundingClientRect().height + 14;
        const x2 = trigger.getBoundingClientRect().left - bounds.left - 3;
        const y2 = top + triggerHeight / 2;
        for (const { action, el } of linked) {
          const rect = el!.getBoundingClientRect();
          edges.push({
            action,
            issue: issue.id,
            kind: issue.kind,
            context: issue.contextActionIds.includes(action),
            x1: rect.right - bounds.left + 3,
            y1: rect.top - bounds.top + rect.height / 2,
            x2,
            y2,
          });
        }
      }
      const next = {
        height: Math.max(actionColumn.getBoundingClientRect().height, bottom),
        tops,
        edges,
      };
      setGeometry((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      );
    }
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    }
    const observer = new ResizeObserver(schedule);
    observer.observe(actionColumn);
    observer.observe(issueColumn);
    section
      .querySelectorAll(".log-action, .evidence-finding")
      .forEach((el) => observer.observe(el));
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [findings]);

  const emphasis = (edge: Edge) =>
    highlightedIssue
      ? edge.issue === highlightedIssue
      : edge.action === focusedAction;
  return (
    <div
      ref={root}
      className="evidence-section"
      data-section={id}
      style={geometry.height ? { minHeight: geometry.height } : undefined}
    >
      <div className="section-actions">{actions}</div>
      <div className="section-findings">
        {findings.map(({ issue, node }) => (
          <div
            key={issue.id}
            className="evidence-finding"
            data-finding={issue.id}
            style={
              geometry.height
                ? { top: geometry.tops[issue.id] ?? 0 }
                : undefined
            }
          >
            {node}
          </div>
        ))}
      </div>
      {geometry.height > 0 && (
        <svg
          className="evidence-lines"
          aria-hidden="true"
          width="100%"
          height={geometry.height}
        >
          {[...geometry.edges]
            .sort((a, b) => Number(emphasis(a)) - Number(emphasis(b)))
            .map((edge) => {
              const gap = edge.x2 - edge.x1;
              const strong = emphasis(edge);
              const path = `M ${edge.x1} ${edge.y1} C ${edge.x1 + gap * 0.48} ${edge.y1}, ${edge.x2 - gap * 0.48} ${edge.y2}, ${edge.x2} ${edge.y2}`;
              const maskId = `trace-${id}-${edge.issue}-${edge.action}`;
              return (
                <g
                  key={`${edge.issue}:${edge.action}`}
                  className={`evidence-link kind-${edge.kind} ${edge.context ? "is-context" : "is-evidence"} ${strong ? "is-emphasized" : ""}`}
                  data-action={edge.action}
                  data-issue-link={edge.issue}
                  data-context={edge.context}
                  data-in-view={visibleFindings.has(edge.issue)}
                >
                  <defs>
                    <mask
                      id={maskId}
                      maskUnits="userSpaceOnUse"
                      x={edge.x1 - 5}
                      y={Math.min(edge.y1, edge.y2) - 5}
                      width={gap + 10}
                      height={Math.abs(edge.y2 - edge.y1) + 10}
                    >
                      <path className="line-reveal" d={path} pathLength="1" />
                    </mask>
                  </defs>
                  <path
                    className="connection-stroke"
                    d={path}
                    mask={`url(#${maskId})`}
                  />
                  <circle
                    className="action-endpoint"
                    cx={edge.x1}
                    cy={edge.y1}
                    r={strong ? 3 : 2}
                  />
                  <circle
                    className="finding-endpoint"
                    cx={edge.x2}
                    cy={edge.y2}
                    r={strong ? 3 : 2}
                  />
                </g>
              );
            })}
        </svg>
      )}
    </div>
  );
}
