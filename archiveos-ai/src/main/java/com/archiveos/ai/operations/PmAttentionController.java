package com.archiveos.ai.operations; import java.util.*; import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/pm-attention") public class PmAttentionController {private final PmAttentionService s;public PmAttentionController(PmAttentionService s){this.s=s;}@GetMapping public Map<String,Object>items(){return Map.of("data",s.items());}}
