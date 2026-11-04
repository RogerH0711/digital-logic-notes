---
title: Verilog HDL 入門
unit: 8
summary: 用 Verilog 的閘級、資料流、行為三種寫法描述電路，分清阻隔與非阻隔指定，並寫出測試平台與狀態機。
tags: [Verilog, 組合電路, 狀態機]
prerequisites: [06-sequential-design]
updated: 2026-11-04
---

## 學習目標

- 能寫出 `module` 的基本結構，宣告輸入輸出與 `wire`、`reg`。
- 會用閘級、資料流、行為三種寫法描述同一個組合電路。
- 能分辨位元運算子與邏輯運算子、阻隔指定與非阻隔指定。
- 會寫簡單的測試平台，並用 Verilog 描述 Moore 狀態機。

## 為什麼要用 HDL

硬體描述語言（hardware description language, HDL）用文字描述電路，再交給工具模擬或合成成實際的閘。好處是設計者可以專注在「電路要做什麼」，由工具處理「怎麼接」，也能在做出晶片前先用模擬看時序圖、反覆修正。Verilog 是最常用的 HDL 之一，課本另外也介紹 VHDL 與 SystemVerilog。

::: warning Verilog 不是程式語言
Verilog 長得像 C，但每一行描述的是**同時存在的硬體**，不是依序執行的指令。寫的時候要一直問自己：「這段會合成出什麼電路？」
:::

## 基本結構

### module 與連接埠

電路的基本單位是 `module`，從 `module` 開始、`endmodule` 結束，括號內列出連接埠（port）：

```verilog
module half_adder (
  input  a,
  input  b,
  output s,
  output c
);
  assign s = a ^ b;
  assign c = a & b;
endmodule
```

多位元的訊號用 `[MSB:LSB]` 宣告，例如 `input [3:0] x;` 是 4 位元，`x[3]` 是最高位。

### 四種邏輯值與資料型態

Verilog 的每個位元有四種值：`0`、`1`、`x`（未知）、`z`（高阻抗，等於斷線）。模擬波形中 `x` 通常顯示成紅色、`z` 顯示成中間的線。

| 型態 | 代表 | 預設值 | 用在 |
| --- | --- | :-: | --- |
| `wire` | 實體連線，自己不保存值 | `z` | `assign` 的左邊、模組之間的連線 |
| `reg` | 在程序區塊中被指定的變數 | `x` | `always`、`initial` 區塊內的左邊 |

::: warning reg 不一定是暫存器
`reg` 只表示「這個變數在 `always` 區塊裡被指定」。在組合邏輯的 `always @(*)` 裡宣告成 `reg` 的變數，合成後只是一般的連線。
:::

### 數字表示

格式是 `位元數'進位值`，例如 `4'b1010`（4 位元二進位）、`8'hFF`（8 位元十六進位）、`4'd7`（4 位元十進位）。不寫位元數時預設是 32 位元，接到較窄的訊號會被截斷，容易出錯，建議都寫清楚。

## 組合電路的三種寫法

以 2 對 1 多工器 $y = \inv{s}a + sb$ 為例。

### 閘級（結構）寫法

用內建的閘原始元件（`and`、`or`、`not`、`nand`、`nor`、`xor`、`xnor`、`buf`）組出電路，**第一個埠是輸出**：

```verilog
module mux2_gate (input a, b, s, output y);
  wire s_n, t0, t1;
  not g0 (s_n, s);
  and g1 (t0, a, s_n);
  and g2 (t1, b, s);
  or  g3 (y, t0, t1);
endmodule
```

使用其他模組時也一樣是實例化（instantiation）。連接方式有兩種：

- 依位置：`half_adder ha0 (x, y, sum, carry);`，順序要和宣告一致。
- 依名稱：`half_adder ha0 (.a(x), .b(y), .s(sum), .c(carry));`，不怕順序錯，模組大時建議用這種。

### 資料流寫法

用 `assign` 做連續指定（continuous assignment）：右邊任何訊號一變，左邊立刻跟著更新，就像一條接好的線。

```verilog
module mux2_flow (input a, b, s, output y);
  assign y = s ? b : a;
endmodule
```

`條件 ? 為真時的值 : 為假時的值` 是條件運算子，正好對應多工器。

### 行為寫法

用 `always` 區塊描述「在什麼情況下輸出是什麼」，左邊必須是 `reg`：

```verilog
module mux2_behav (input a, b, s, output reg y);
  always @(*) begin
    if (s) y = b;
    else   y = a;
  end
endmodule
```

`@(*)` 表示區塊內讀到的任何訊號改變都要重新計算，用來描述組合電路。

::: warning 組合邏輯的 always 要給所有情況
在組合電路的 `always @(*)` 中，若某些條件下沒有指定輸出（例如 `if` 沒有 `else`、`case` 沒有 `default`），合成工具會推論出閂鎖來「記住」舊值，變成意料外的循序電路。
:::

### 條件判斷：if 與 case

`if-else if-else` 有優先順序，先成立的先處理，適合描述優先權編碼器。`case` 則是把一個運算式和多個值逐一比對，適合解碼器、多工器、狀態機：

```verilog
always @(*) begin
  case (sel)
    2'b00:   y = d0;
    2'b01:   y = d1;
    2'b10:   y = d2;
    default: y = d3;
  endcase
end
```

## 運算子

### 位元運算與邏輯運算

| 運算 | 位元運算子 | 邏輯運算子 |
| --- | :-: | :-: |
| AND | `&` | `&&` |
| OR | `\|` | `\|\|` |
| NOT | `~` | `!` |

位元運算子對每一位分別運算，結果和運算元一樣寬。邏輯運算子把整個運算元當成一個真假值（非 0 即為真），結果只有 1 位元。

以 `A = 4'b0110`、`B = 4'b1101` 為例：`A & B = 4'b0100`，但 `A && B = 1`，因為兩者都不是 0。

其他常用的還有 `^`（XOR）、`+`、`-`、比較運算子 `==`、`<`，以及串接 `{a, b}`。

## 循序電路

### D 正反器

```verilog
module dff (input clk, rst_n, d, output reg q);
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) q <= 1'b0;   // 非同步清除，低態有效
    else        q <= d;
  end
endmodule
```

`posedge clk` 表示時脈上升緣觸發。把 `negedge rst_n` 放進敏感清單，清除就不必等時脈，是[第 5 單元](05-latches-flipflops.html)提到的直接輸入。

### 阻隔與非阻隔指定

::: definition 兩種程序指定
- 阻隔指定（blocking，`=`）：**依序**執行，這一行算完、左邊更新後，下一行才開始，下一行讀到的是新值。
- 非阻隔指定（non-blocking，`<=`）：同一個區塊裡的所有右邊**先全部用舊值算好**，區塊結束時再**同時**更新左邊。
:::

非阻隔的「同時更新」正好符合正反器在時脈邊緣一起取樣的行為。比較下面兩段：

```verilog
// 非阻隔：三個正反器串成移位暫存器
always @(posedge clk) begin
  b <= a;
  c <= b;   // 用的是 b 的舊值
end

// 阻隔：c 拿到的是剛更新的 b，也就是 a
always @(posedge clk) begin
  b = a;
  c = b;
end
```

第一段合成出 a → b → c 兩級移位；第二段 b 和 c 在同一個時脈都變成 a，中間那級正反器等於被跳過。

::: tip 兩條實用規則
描述循序電路（`posedge clk`）用 `<=`；描述組合電路（`@(*)`）用 `=`。同一個 `always` 區塊不要混用。
:::

::: warning 「並行」與「依序」容易說反
阻隔指定是**依序**執行，非阻隔指定才是**同時**更新。有些教材用「concurrent」形容其中一種，記的時候以「後面那一行讀到舊值還是新值」為準，比較不會搞混。
:::

## 測試平台

測試平台（testbench）是一個沒有連接埠的模組，負責產生輸入刺激、觀察受測電路（unit under test, UUT）的輸出。它只用來模擬，不會被合成。

```verilog
`timescale 1ns/1ps
module tb_mux2;
  reg  a, b, s;
  wire y;

  mux2_flow uut (.a(a), .b(b), .s(s), .y(y));

  initial begin
    a = 0; b = 1; s = 0;
    #10 s = 1;
    #10 a = 1; b = 0;
    #10 s = 0;
    #10 $finish;
  end

  initial $monitor("t=%0t s=%b a=%b b=%b y=%b", $time, s, a, b, y);
endmodule
```

- `initial` 區塊在模擬開始時執行一次，只能用在測試平台。
- `#10` 表示等 10 個時間單位，單位由 `` `timescale `` 決定。
- 以錢字號開頭的是系統任務（system task）：上例的 monitor 在任何列出的訊號改變時印出一行，finish 結束模擬。
- 測試結果只和測試平台一樣好：要盡量涵蓋所有功能與邊界情況。

## 用 Verilog 寫狀態機

以[第 6 單元](06-sequential-design.html)的 110 偵測器（Moore 機）為例。標準寫法分成三塊：狀態暫存器、下一個狀態邏輯、輸出邏輯。

```verilog
module detect110 (input clk, rst_n, x, output y);
  localparam S0 = 2'b00, S1 = 2'b01, S2 = 2'b11, S3 = 2'b10;
  reg [1:0] state, next;

  // 1. 狀態暫存器：時脈邊緣更新，用 <=
  always @(posedge clk or negedge rst_n)
    if (!rst_n) state <= S0;
    else        state <= next;

  // 2. 下一個狀態：組合電路，用 =
  always @(*) begin
    case (state)
      S0: next = x ? S1 : S0;
      S1: next = x ? S2 : S0;
      S2: next = x ? S2 : S3;
      S3: next = x ? S1 : S0;
      default: next = S0;
    endcase
  end

  // 3. 輸出：Moore 機只看狀態
  assign y = (state == S3);
endmodule
```

狀態編碼直接沿用第 6 單元的格雷碼指定。若要改成 Mealy 機，第 3 塊的輸出就要同時看 `state` 與 `x`。

## 重點整理

- `module ... endmodule` 是基本單位；`wire` 是連線，`reg` 是在程序區塊中被指定的變數。
- 每個位元有 0、1、x、z 四種值；數字寫成 `位元數'進位值`。
- 三種寫法：閘級（原始元件、實例化）、資料流（`assign`）、行為（`always`）。
- `&`、`|`、`~` 逐位運算；`&&`、`||`、`!` 把整體當真假值，結果 1 位元。
- 循序電路用 `<=`（同時更新），組合電路用 `=`（依序）；組合 `always` 要涵蓋所有情況以免推論出閂鎖。
- 測試平台用 `initial` 產生刺激，只用來模擬；狀態機分成狀態暫存器、下一個狀態、輸出三塊。

## 練習題

:::: exercise 設 `A = 4'b1010`、`B = 4'b0011`，求 `A & B`、`A && B`、`A | B`、`~A`、`!A`
::: answer
- `A & B`：逐位 AND，$1010$ 與 $0011$ 得 `4'b0010`。
- `A && B`：兩者都非 0，結果 `1'b1`。
- `A | B`：逐位 OR，得 `4'b1011`。
- `~A`：逐位反相，得 `4'b0101`。
- `!A`：`A` 非 0 為真，取反得 `1'b0`。
:::
::::

:::: exercise 用資料流寫法描述 4 對 1 多工器，選擇線是 2 位元的 `s`
::: answer
用巢狀的條件運算子，先看高位再看低位：

```verilog
module mux4 (input d0, d1, d2, d3, input [1:0] s, output y);
  assign y = s[1] ? (s[0] ? d3 : d2)
                  : (s[0] ? d1 : d0);
endmodule
```

也可以寫成 `assign y = (s == 2'b00) ? d0 : (s == 2'b01) ? d1 : (s == 2'b10) ? d2 : d3;`，功能相同。
:::
::::

:::: exercise 下面的程式想做 3 級移位暫存器，哪裡錯了？怎麼改？
```verilog
always @(posedge clk) begin
  q1 = d;
  q2 = q1;
  q3 = q2;
end
```

::: answer
用了阻隔指定 `=`，三行依序執行：`q1` 先變成 `d`，`q2` 讀到的是新的 `q1`（也就是 `d`），`q3` 也一樣。結果一個時脈後三個輸出都等於 `d`，等於只有一級。

改成非阻隔指定，三個右邊都先用舊值算好再同時更新：

```verilog
always @(posedge clk) begin
  q1 <= d;
  q2 <= q1;
  q3 <= q2;
end
```
:::
::::
