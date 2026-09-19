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
  lane: number;
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
  const findingIds = findings.map(({ issue }) => issue.id).join(",");

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
  }, [findingIds]);

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
      for (const [
        index,
        { issue, element, linked, target },
      ] of nodes.entries()) {
        const trigger = element.querySelector<HTMLElement>(".issue-trigger")!;
        const triggerHeight = trigger.getBoundingClientRect().height;
        const top = Math.max(0, bottom, target - triggerHeight / 2);
        tops[issue.id] = top;
        bottom = top + element.getBoundingClientRect().height + 14;
        const x2 = trigger.getBoundingClientRect().left - bounds.left - 3;
        const y2 = top + triggerHeight / 2;
        for (const { action, el } of linked) {
          const rect = el!.getBoundingClientRect();
          const x1 = rect.right - bounds.left + 3;
          edges.push({
            action,
            issue: issue.id,
            kind: issue.kind,
            context: issue.contextActionIds.includes(action),
            x1,
            y1: rect.top - bounds.top + rect.height / 2,
            x2,
            y2,
            lane:
              x1 +
              12 +
              (nodes.length === 1 ? 0.5 : index / (nodes.length - 1)) *
                (x2 - x1 - 24),
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
  const bundles = findings
    .map(({ issue }) => {
      const edges = geometry.edges.filter((edge) => edge.issue === issue.id);
      return { issue, edges, strong: edges.some(emphasis) };
    })
    .filter((bundle) => bundle.edges.length > 0);
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
            className={`evidence-finding kind-${issue.kind}`}
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
          {bundles.map(({ issue, edges, strong }) => {
            const { lane, x2, y2 } = edges[0];
            const top = Math.min(y2, ...edges.map((edge) => edge.y1));
            const bottom = Math.max(y2, ...edges.map((edge) => edge.y1));
            const path = `M ${lane} ${top} V ${bottom} M ${lane} ${y2} H ${x2}`;
            const maskId = `bundle-${id}-${issue.id}`;
            return (
              <g
                key={issue.id}
                className={`evidence-bundle kind-${issue.kind} ${strong ? "is-emphasized" : ""} ${edges.every((edge) => edge.context) ? "is-context" : ""}`}
                data-bundle={issue.id}
                data-in-view={visibleFindings.has(issue.id)}
              >
                <defs>
                  <mask
                    id={maskId}
                    maskUnits="userSpaceOnUse"
                    x={lane - 5}
                    y={top - 5}
                    width={x2 - lane + 10}
                    height={bottom - top + 10}
                  >
                    <path className="line-reveal" d={path} pathLength="1" />
                  </mask>
                </defs>
                <path
                  className="connection-stroke"
                  d={path}
                  mask={`url(#${maskId})`}
                />
              </g>
            );
          })}
          {[...geometry.edges]
            .sort((a, b) => Number(emphasis(a)) - Number(emphasis(b)))
            .map((edge) => {
              const strong = emphasis(edge);
              // Short branches share one vertical rail and outlet per finding.
              const path = `M ${edge.x1} ${edge.y1} H ${edge.lane}`;
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
                      width={edge.lane - edge.x1 + 10}
                      height={Math.abs(edge.y2 - edge.y1) + 10}
                    >
                      <path className="line-reveal" d={path} pathLength="1" />
                    </mask>
                  </defs>
                  <path
                    className="connection-crossing"
                    d={path}
                    mask={`url(#${maskId})`}
                  />
                  <path
                    className="connection-stroke"
                    d={path}
                    mask={`url(#${maskId})`}
                  />
                  <circle
                    className="action-endpoint"
                    cx={edge.x1}
                    cy={edge.y1}
                    r={strong ? 2.3 : 1.5}
                  />
                  <circle
                    className="finding-endpoint"
                    cx={edge.x2}
                    cy={edge.y2}
                    r={strong ? 2.3 : 1.5}
                  />
                </g>
              );
            })}
        </svg>
      )}
    </div>
  );
}
