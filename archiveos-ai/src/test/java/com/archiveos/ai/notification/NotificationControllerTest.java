package com.archiveos.ai.notification;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class NotificationControllerTest {
    @Test void delegatesSlackDeliveryToJavaNotificationService() throws Exception {
        NotificationService notifications = org.mockito.Mockito.mock(NotificationService.class);
        when(notifications.send("test alert"))
                .thenReturn(List.of(new NotificationResult("slack", true, true, null)));
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new NotificationController(notifications)).build();

        mvc.perform(post("/api/notifications")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"test alert\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.results[0].channel").value("slack"))
                .andExpect(jsonPath("$.data.results[0].sent").value(true));
    }

    @Test void rejectsBlankMessages() throws Exception {
        NotificationService notifications = org.mockito.Mockito.mock(NotificationService.class);
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new NotificationController(notifications)).build();

        mvc.perform(post("/api/notifications")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"\"}"))
                .andExpect(status().isBadRequest());
    }
}
