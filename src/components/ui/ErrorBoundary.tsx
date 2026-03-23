"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * ErrorBoundary 组件属性
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  /** 自定义回退 UI，接收 error 和 reset 函数 */
  fallback?: (props: { error: Error; reset: () => void }) => ReactNode;
}

/**
 * ErrorBoundary 组件状态
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * 全局错误边界组件
 * 捕获子组件树中的 JavaScript 运行时错误，防止整个页面白屏崩溃
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ErrorBoundary] 捕获到渲染错误:", error, errorInfo);

    // 如果需要其他监控逻辑，可以在此处扩展
  }

  /** 重置错误状态，允许用户重试 */
  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (!this.state.hasError || !this.state.error) {
      return this.props.children;
    }

    // 优先使用自定义回退 UI
    if (this.props.fallback) {
      return this.props.fallback({
        error: this.state.error,
        reset: this.handleReset,
      });
    }

    // 默认的错误回退 UI
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "50vh",
          padding: "2rem",
          textAlign: "center",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div
          style={{
            fontSize: "3rem",
            marginBottom: "1rem",
          }}
        >
          😵
        </div>
        <h2
          style={{
            fontSize: "1.25rem",
            fontWeight: 600,
            color: "#e5e7eb",
            marginBottom: "0.5rem",
          }}
        >
          页面出现了一点问题
        </h2>
        <p
          style={{
            fontSize: "0.875rem",
            color: "#9ca3af",
            marginBottom: "1.5rem",
            maxWidth: "400px",
          }}
        >
          {this.state.error.message || "发生了未知错误，请尝试刷新页面。"}
        </p>
        <button
          onClick={this.handleReset}
          style={{
            padding: "0.5rem 1.5rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            color: "#fff",
            backgroundColor: "#6366f1",
            border: "none",
            borderRadius: "0.5rem",
            cursor: "pointer",
            transition: "background-color 0.2s",
          }}
          onMouseOver={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = "#4f46e5";
          }}
          onMouseOut={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = "#6366f1";
          }}
        >
          重新加载
        </button>
      </div>
    );
  }
}
