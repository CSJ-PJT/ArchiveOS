package com.archiveos.ai.obsidian;

import java.util.List;

public record RagAnswer(String answer, List<RagReference> references) {}
