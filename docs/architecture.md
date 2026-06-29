# Architecture

`jmxpls` uses four representations: canonical JMX AST, semantic plan model, Plan Language projection, and JMeter runtime validation. The canonical layer preserves XML/hashTree structure and unknown plugin content. The semantic layer is the compact agent-facing view used by tools and resources.
